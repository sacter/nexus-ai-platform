<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { CopyDocument, WarningFilled, View, Download, Clock, Refresh } from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { usePagedDocuments, useDeleteDocument, useDownloadUrl, useReindexDocument } from '@/modules/knowledge/composables/useDocuments'
import type { Document } from '@/modules/knowledge/types/document'
import { formatDate } from '@/utils/format'
import DocumentUpload from '@/modules/knowledge/components/DocumentUpload.vue'
import VersionHistory from '@/modules/knowledge/components/VersionHistory.vue'

const props = defineProps<{
  /** 知识库 ID；未传时回退到路由 query.kbId（独立"文档管理"页） */
  kbId?: string
  /** 嵌入到知识库详情时：隐藏页头/上传区，显示 切片详情/Embedding 操作 */
  embedded?: boolean
  /** 编辑权限（admin），控制 Embedding 按钮显示 */
  canEdit?: boolean
}>()

defineEmits<{
  (e: 'view-chunks', doc: Document): void
  (e: 'embedding'): void
}>()

const route = useRoute()
const router = useRouter()
const kbId = computed(() => props.kbId || (route.query.kbId as string) || '')

const page = ref(1)
const pageSize = ref(20)
const { data: docData, isLoading, refetch } = usePagedDocuments(kbId, page, pageSize)
const total = computed(() => docData.value?.total ?? 0)

// 删除/刷新后当前页可能越界 → 回退到最后一页
watch(total, (t) => {
  const maxPage = Math.max(1, Math.ceil(t / pageSize.value))
  if (page.value > maxPage) page.value = maxPage
})
const deleteMutation = useDeleteDocument()
const reindexMutation = useReindexDocument()

// 下载
const downloadDocId = ref<string | null>(null)
const { refetch: fetchDownloadUrl } = useDownloadUrl(
  kbId,
  () => downloadDocId.value || '',
)

// 版本历史弹窗
const versionHistoryDoc = ref<Document | null>(null)
const popoverVisibleRow = ref('')

const docsList = computed(() => (docData.value?.items || []).map((doc) => {
  return {
    ...doc,
    version: doc.currentVersion?.versionNumber || 1,
    updatedAt: formatDate(doc.updatedAt, 'yyyy-mm-dd hh:mm:ss') || '--',
    createdAt: formatDate(doc.createdAt, 'yyyy-mm-dd hh:mm:ss') || '--',
  }
})
);

/* ---------- 行内操作 ---------- */

function handleView(doc: Document) {
  router.push({
    name: 'DocumentDetail',
    params: { id: doc.id },
    query: { kbId: kbId.value },
  })
}

async function handleDownload(doc: Document) {
  downloadDocId.value = doc.id
  try {
    const result = await fetchDownloadUrl()
    if (result.data?.url) {
      window.open(result.data.url, '_blank')
    }
  } finally {
    downloadDocId.value = null
  }
}

function handleDeleteDoc(id: string) {
  deleteMutation.mutate({ kbId: kbId.value, id })
}

function handleConfirmDelete(id: string) {
  popoverVisibleRow.value = ''
  handleDeleteDoc(id)
}

async function handleCopyDocId(id: string) {
  try {
    await navigator.clipboard.writeText(id)
    ElMessage.success('文档ID已复制')
  } catch {
    ElMessage.error('复制失败，请手动复制')
  }
}

function handleVersionHistory(doc: Document) {
  versionHistoryDoc.value = doc
}

async function handleReindex(doc: Document) {
  try {
    await ElMessageBox.confirm(
      `确定重新索引文档 "${doc.name}"？将重新执行切片与向量化，期间该文档状态变为"处理中"。`,
      '重新索引',
      { confirmButtonText: '重新索引', cancelButtonText: '取消', type: 'warning' },
    )
  } catch {
    return // 取消
  }
  reindexMutation.mutate({ kbId: kbId.value, id: doc.id })
}

function handleUploaded() {
  page.value = 1
  refetch()
}

/* ---------- 状态 / 格式辅助 ---------- */

function statusTagType(status: Document['status']): 'info' | 'success' | 'warning' | 'danger' | '' {
  const map: Record<string, 'info' | 'success' | 'warning' | 'danger' | ''> = {
    UPLOADING: 'warning',
    PROCESSING: 'warning',
    READY: 'success',
    FAILED: 'danger',
    DELETED: 'info',
  }
  return map[status] || 'info'
}

function statusLabel(status: Document['status']): string {
  const map: Record<string, string> = {
    UPLOADING: '上传中',
    PROCESSING: '处理中',
    READY: '就绪',
    FAILED: '失败',
    DELETED: '已删除',
  }
  return map[status] || status
}

function mimeTypeLabel(mime: string): string {
  if (mime.includes('pdf')) return 'PDF'
  if (mime.includes('word') || mime.includes('document')) return 'Word'
  if (mime.includes('excel') || mime.includes('spreadsheet')) return 'Excel'
  if (mime.includes('powerpoint') || mime.includes('presentation')) return 'PPT'
  if (mime.includes('markdown')) return 'MD'
  if (mime.includes('text')) return 'TXT'
  return mime.split('/')[1]?.toUpperCase() || 'FILE'
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  return (bytes / 1024 / 1024).toFixed(2) + ' MB'
}
</script>

<template>
  <div class="document-list-page" :class="{ 'is-embedded': embedded }">
    <template v-if="!embedded">
      <div class="page-header">
        <h1 class="page-title">文档管理</h1>
      </div>
      <div class="upload-section">
        <DocumentUpload :kb-id="kbId" @uploaded="handleUploaded" />
      </div>
    </template>

    <div class="table-section" :class="{ 'table-section--embedded': embedded }">
      <el-table
        :data="docsList"
        v-loading="isLoading"
        stripe
        empty-text="请先导入文档"
      >
        <!-- 文档名称 / ID -->
        <el-table-column label="文档名称 / ID" min-width="240" fixed>
          <template #default="{ row }">
            <div>
              <el-tooltip
                :content="row.name"
                placement="top"
                :show-after="200"
              >
                <div class="font-medium overflow-hidden whitespace-nowrap text-ellipsis" style="color: var(--foreground)">{{ row.name }}</div>
              </el-tooltip>
              <div class="flex items-center gap-1 text-xs" style="color: var(--foreground); opacity: 0.4">
                <span class="overflow-hidden whitespace-nowrap text-ellipsis">文档 ID</span>
                <el-tooltip content="复制文档 ID" placement="top" :show-after="200">
                  <el-icon
                    class="cursor-pointer shrink-0 hover:text-primary"
                    :size="13"
                    @click="handleCopyDocId(row.id)"
                  >
                    <CopyDocument />
                  </el-icon>
                </el-tooltip>
              </div>
            </div>
          </template>
        </el-table-column>

        <!-- 类型 -->
        <el-table-column label="类型" width="80" align="center">
          <template #default="{ row }">
            <span class="doc-type-tag">{{ mimeTypeLabel(row.mimeType) }}</span>
          </template>
        </el-table-column>

        <!-- 大小 -->
        <el-table-column label="大小" width="90" align="right">
          <template #default="{ row }">
            {{ formatSize(Number(row.fileSize)) }}
          </template>
        </el-table-column>

        <!-- 状态 -->
        <el-table-column label="状态" width="100" align="center">
          <template #default="{ row }">
            <el-tag :type="statusTagType(row.status)" size="small">
              {{ statusLabel(row.status) }}
            </el-tag>
          </template>
        </el-table-column>

        <!-- 切片数 -->
        <el-table-column label="切片数" width="80" align="center">
          <template #default="{ row }">
            {{ row.chunkCount }}
          </template>
        </el-table-column>

        <!-- 版本 -->
        <el-table-column label="版本" width="70" align="center">
          <template #default="{ row }">
            v{{ row.version }}
          </template>
        </el-table-column>

        <!-- 上传者 -->
        <el-table-column label="上传者" width="100">
          <template #default="{ row }">
            {{ row.user?.username || '-' }}
          </template>
        </el-table-column>

        <!-- 上传时间 -->
        <el-table-column label="上传时间" width="170">
          <template #default="{ row }">
            {{ row.createdAt }}
          </template>
        </el-table-column>

        <!-- 更新时间 -->
        <el-table-column label="更新时间" width="170">
          <template #default="{ row }">
            {{ row.updatedAt }}
          </template>
        </el-table-column>

        <!-- 操作 -->
        <el-table-column label="操作" :width="embedded ? 360 : 240" fixed="right">
          <template #default="{ row }">
            <div class="operation-cell flex items-center gap-1">
              <el-button
                v-if="embedded"
                size="small"
                text
                type="primary"
                @click="$emit('view-chunks', row)"
              >
                切片详情
              </el-button>
              <!-- <el-button
                v-if="embedded && canEdit"
                size="small"
                text
                type="primary"
                @click="$emit('embedding')"
              >
                Embedding
              </el-button> -->
              <el-tooltip content="预览">
                <el-button :icon="View" size="small" text @click="handleView(row)" />
              </el-tooltip>
              <el-tooltip content="下载">
                <el-button :icon="Download" size="small" text @click="handleDownload(row)" />
              </el-tooltip>
              <el-tooltip content="版本历史">
                <el-button :icon="Clock" size="small" text @click="handleVersionHistory(row)" />
              </el-tooltip>
              <el-tooltip content="重新索引">
                <el-button :icon="Refresh" size="small" text @click="handleReindex(row)" />
              </el-tooltip>
              <el-popover
                :visible="popoverVisibleRow === row.id"
                trigger="click"
                width="340"
                @hide="popoverVisibleRow = ''"
              >
                <template #reference>
                  <el-button
                    size="small"
                    text
                    type="danger"
                    @click="popoverVisibleRow = row.id"
                  >
                    删除
                  </el-button>
                </template>
                <div class="px-1">
                  <div class="flex items-center gap-1.5 mb-2">
                    <el-icon :size="15" color="#f90">
                      <WarningFilled />
                    </el-icon>
                    <span class="font-medium text-sm" style="color: var(--el-text-color-primary)">
                      确定删除所选文档？
                    </span>
                  </div>
                  <p class="text-xs leading-5" style="color: var(--el-text-color-regular)">
                    确定删除文档【{{ row.name }}】？删除不可恢复，请谨慎操作
                  </p>
                  <div class="flex justify-end mt-3">
                    <el-button size="small" @click="popoverVisibleRow = ''">取消</el-button>
                    <el-button size="small" type="primary" @click="handleConfirmDelete(row.id)">确定</el-button>
                  </div>
                </div>
              </el-popover>
            </div>
          </template>
        </el-table-column>
      </el-table>
      <div v-if="total > 0" class="table-pagination flex justify-end mt-4">
        <el-pagination
          v-model:current-page="page"
          v-model:page-size="pageSize"
          :total="total"
          :page-sizes="[20, 50, 100]"
          layout="total, sizes, prev, pager, next, jumper"
        />
      </div>
    </div>

    <!-- 版本历史弹窗 -->
    <VersionHistory
      v-if="versionHistoryDoc"
      :document="versionHistoryDoc"
      :kb-id="kbId"
      @close="versionHistoryDoc = null"
      @activated="versionHistoryDoc = null"
    />
  </div>
</template>

<style scoped>
.document-list-page {
  padding: 0;
}
.is-embedded {
  padding: 0;
}
.page-header {
  margin-bottom: 20px;
}
.page-title {
  font-size: 24px;
  font-weight: 600;
  color: var(--foreground, #303133);
  margin: 0;
}
.upload-section {
  margin-bottom: 24px;
}
.table-section {
  background: var(--bg-primary, #fff);
  border-radius: 8px;
  padding: 16px;
  border: 1px solid var(--border-color, #ebeef5);
}
.table-section--embedded {
  background: transparent;
  border: none;
  border-radius: 0;
  padding: 0;
}
.doc-type-tag {
  font-size: 12px;
  color: var(--foreground-secondary, #606266);
  background: var(--bg-secondary, #f0f2f5);
  padding: 1px 6px;
  border-radius: 4px;
}
/* 操作列按钮间距由容器 gap 控制，覆盖 Element Plus 相邻按钮默认 12px 间距 */
:deep(.operation-cell .el-button + .el-button) {
  margin-left: 0;
}
</style>
