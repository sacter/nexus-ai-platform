import { ref, computed, readonly } from 'vue'
import { ElMessage } from 'element-plus'
import { S3Client, AbortMultipartUploadCommand } from '@aws-sdk/client-s3'
import { Upload } from '@aws-sdk/lib-storage'
import { uploadApi, documentsApi } from '@/modules/knowledge/api/document.api'
import type {
  UploadFileItem,
  StsCredentials,
  SaveMetaRequest,
} from '@/modules/knowledge/types/document'
import {
  ALLOWED_MIME_TYPES,
  ALLOWED_EXTENSIONS,
  MAX_FILE_SIZE,
} from '@/modules/knowledge/types/document'

/**
 * 文件上传 Composable
 *
 * 核心流程：
 * 1. 前端校验文件类型、大小
 * 2. 获取 MinIO STS 临时凭证（仅内存保存）
 * 3. AWS SDK (S3Client) + STS 凭证直传 MinIO
 *    - lib-storage 的 Upload 自动处理分片（>5MB 自动分片）
 *    - 支持进度回调
 * 4. 上传成功后回写元数据到后端
 *
 * 安全：
 * - STS 凭证仅内存使用，绝不存储 localStorage/cookie
 * - 页面刷新凭证自动销毁
 */
export function useUpload(kbId: string) {
  // --- 状态 ---
  const fileList = ref<UploadFileItem[]>([])
  const uploading = ref(false)
  const stsCredentials = ref<StsCredentials | null>(null)
  const stsLoaded = ref(false)
  const stsLoading = ref(false)
  const activeUploads = new Map<string, { abort: () => void }>()

  // --- 计算属性 ---
  const pendingCount = computed(() =>
    fileList.value.filter((f) => f.status === 'pending').length,
  )
  const uploadingCount = computed(() =>
    fileList.value.filter((f) => f.status === 'uploading').length,
  )
  const successCount = computed(() =>
    fileList.value.filter((f) => f.status === 'success').length,
  )
  const failedCount = computed(() =>
    fileList.value.filter((f) => f.status === 'failed').length,
  )

  // ============================================
  // 文件校验
  // ============================================

  function validateFileType(file: File): boolean {
    const ext = '.' + file.name.split('.').pop()?.toLowerCase()
    if (!ALLOWED_EXTENSIONS.includes(ext as typeof ALLOWED_EXTENSIONS[number])) {
      ElMessage.error(`不支持的文件类型: ${ext}`)
      return false
    }
    if (
      file.type &&
      file.type !== 'application/octet-stream' &&
      !ALLOWED_MIME_TYPES.includes(file.type as typeof ALLOWED_MIME_TYPES[number])
    ) {
      ElMessage.error(`不支持的文件格式: ${file.type}`)
      return false
    }
    return true
  }

  function validateFileSize(file: File): boolean {
    if (file.size > MAX_FILE_SIZE) {
      ElMessage.error(`文件过大: ${(file.size / 1024 / 1024).toFixed(1)}MB，上限 500MB`)
      return false
    }
    if (file.size === 0) {
      ElMessage.error('文件为空，无法上传')
      return false
    }
    return true
  }

  // ============================================
  // STS 凭证管理（仅内存，不持久化）
  // ============================================

  async function fetchStsCredentials(): Promise<StsCredentials | null> {
    if (!kbId) {
      ElMessage.error('缺少知识库 ID')
      return null
    }

    stsLoading.value = true
    try {
      const result = await uploadApi.getSts(kbId)
      const sts: StsCredentials = {
        accessKeyId: result.accessKeyId,
        secretAccessKey: result.secretAccessKey,
        sessionToken: result.sessionToken,
        expiration: result.expiration,
        bucket: result.bucket,
        prefix: result.prefix,
        endpoint: result.endpoint,
        useSSL: result.useSSL,
        port: result.port,
      }
      stsCredentials.value = sts
      stsLoaded.value = true
      return sts
    } catch (err: any) {
      ElMessage.error(`获取上传凭证失败: ${err.message || '未知错误'}`)
      return null
    } finally {
      stsLoading.value = false
    }
  }

  async function ensureStsValid(): Promise<StsCredentials | null> {
    const sts = stsCredentials.value
    if (!sts || !stsLoaded.value) {
      return fetchStsCredentials()
    }
    // 提前 5 分钟续期
    const now = Math.floor(Date.now() / 1000)
    if (sts.expiration - now < 300) {
      return fetchStsCredentials()
    }
    return sts
  }

  // ============================================
  // S3Client 创建（浏览器兼容）
  // ============================================

  function createS3Client(sts: StsCredentials): S3Client {
    const protocol = sts.useSSL ? 'https' : 'http'
    return new S3Client({
      region: 'us-east-1',
      endpoint: `${protocol}://${sts.endpoint}:${sts.port}`,
      forcePathStyle: true,
      credentials: {
        accessKeyId: sts.accessKeyId,
        secretAccessKey: sts.secretAccessKey,
        sessionToken: sts.sessionToken || undefined,
      },
    })
  }

  // ============================================
  // 文件管理
  // ============================================

  function addFiles(files: FileList | File[]) {
    const fileArray = Array.from(files)
    const newItems: UploadFileItem[] = []

    for (const file of fileArray) {
      if (!validateFileType(file) || !validateFileSize(file)) continue

      const exists = fileList.value.find(
        (f) => f.file.name === file.name && f.file.size === file.size,
      )
      if (exists) {
        ElMessage.warning(`文件 "${file.name}" 已在列表中`)
        continue
      }

      newItems.push({
        id: crypto.randomUUID(),
        file,
        name: file.name,
        status: 'pending',
        progress: 0,
      })
    }

    fileList.value = [...fileList.value, ...newItems]
  }

  function removeFile(id: string) {
    fileList.value = fileList.value.filter((f) => f.id !== id)
  }

  function clearCompleted() {
    fileList.value = fileList.value.filter(
      (f) => f.status === 'pending' || f.status === 'uploading',
    )
  }

  function setFileName(id: string, name: string) {
    const item = fileList.value.find((f) => f.id === id)
    if (item) item.name = name
  }

  // ============================================
  // 上传逻辑
  // ============================================

  async function uploadSingleFile(item: UploadFileItem): Promise<void> {
    const sts = await ensureStsValid()
    if (!sts) {
      item.status = 'failed'
      item.error = '无法获取上传凭证'
      return
    }

    item.status = 'uploading'
    item.progress = 0

    try {
      const s3Client = createS3Client(sts)
      const timestamp = Date.now()
      const ext = item.file.name.split('.').pop()?.replace(/[^\w]/g, '') || 'bin'
      const objectName = `${timestamp}_${crypto.randomUUID().slice(0, 8)}.${ext}`
      const objectKey = `${sts.prefix}${objectName}`

      // 使用 @aws-sdk/lib-storage 的 Upload 类
      // 自动处理分片：>5MB 自动分片上传，支持进度跟踪
      const upload = new Upload({
        client: s3Client,
        params: {
          Bucket: sts.bucket,
          Key: objectKey,
          Body: item.file,
          ContentType: item.file.type || 'application/octet-stream',
        },
        // 分片配置
        partSize: 5 * 1024 * 1024, // 5MB 分片（最小 5MB）
        queueSize: 4, // 并发分片数
        leavePartsOnError: false, // 失败时清理分片
      })

      // 注册 abort 控制器（用于暂停/取消）
      activeUploads.set(item.id, {
        abort: () => upload.abort(),
      })

      // 监听上传进度
      upload.on('httpUploadProgress', (progress) => {
        if (progress.total) {
          item.progress = Math.round((progress.loaded! / progress.total) * 95)
        }
      })

      // 执行上传
      await upload.done()

      activeUploads.delete(item.id)
      item.objectKey = objectKey

      // 回写元数据到后端
      await saveMetaData(item)

      item.status = 'success'
      item.progress = 100
    } catch (err: any) {
      activeUploads.delete(item.id)
      // 用户主动取消不算失败
      if (err.name === 'AbortError' || err.$metadata?.httpStatusCode === 499) {
        item.status = 'paused'
        return
      }
      item.status = 'failed'
      item.error = err.message || '上传失败'
      ElMessage.error(`上传 "${item.file.name}" 失败: ${item.error}`)
    }
  }

  /**
   * 回写元数据到后端
   */
  async function saveMetaData(item: UploadFileItem): Promise<void> {
    if (!item.objectKey) throw new Error('缺少文件 Object Key')

    const meta: SaveMetaRequest = {
      name: item.name,
      originalName: item.file.name,
      url: item.objectKey,
      fileSize: item.file.size,
      mimeType: item.file.type || 'application/octet-stream',
      pageCount: 0,
      idempotencyKey: item.id,
    }

    await documentsApi.saveMeta(kbId, meta)
  }

  /**
   * 开始上传所有待上传文件（串行）
   */
  async function startUpload(): Promise<void> {
    if (uploading.value) return
    if (!kbId) {
      ElMessage.error('缺少知识库 ID')
      return
    }

    uploading.value = true

    const pending = fileList.value.filter((f) => f.status === 'pending')
    if (pending.length === 0) {
      ElMessage.warning('没有待上传的文件')
      uploading.value = false
      return
    }

    for (const item of pending) {
      await uploadSingleFile(item)
    }

    uploading.value = false

    const failed = fileList.value.filter((f) => f.status === 'failed')
    if (failed.length > 0) {
      ElMessage.warning(`${successCount.value} 个成功，${failed.length} 个失败`)
    } else {
      ElMessage.success(`全部 ${successCount.value} 个文件上传成功`)
    }
  }

  async function retryFailed(): Promise<void> {
    const failed = fileList.value.filter((f) => f.status === 'failed')
    for (const item of failed) {
      item.status = 'pending'
      item.progress = 0
      item.error = undefined
    }
    await startUpload()
  }

  function pauseUpload() {
    uploading.value = false
    fileList.value
      .filter((f) => f.status === 'uploading')
      .forEach((f) => {
        const controller = activeUploads.get(f.id)
        if (controller) {
          controller.abort()
          activeUploads.delete(f.id)
        }
        f.status = 'paused'
      })
  }

  function destroySts() {
    stsCredentials.value = null
    stsLoaded.value = false
  }

  return {
    fileList,
    uploading: readonly(uploading),
    stsCredentials,
    stsLoaded,
    stsLoading,
    pendingCount,
    uploadingCount,
    successCount,
    failedCount,
    addFiles,
    removeFile,
    clearCompleted,
    setFileName,
    fetchStsCredentials,
    ensureStsValid,
    destroySts,
    startUpload,
    retryFailed,
    pauseUpload,
  }
}
