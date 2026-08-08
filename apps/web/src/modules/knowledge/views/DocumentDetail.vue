<script setup lang="ts">
import { ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { ArrowLeft, Download, Delete, Refresh } from '@element-plus/icons-vue'
import dayjs from 'dayjs'
import {
  useDocument,
  useDeleteDocument,
} from '@/modules/knowledge/composables/useDocuments'
import { documentsApi } from '@/modules/knowledge/api/document.api'
import VersionHistory from '@/modules/knowledge/components/VersionHistory.vue'
import type { Document } from '@/modules/knowledge/types/document'

const route = useRoute()
const router = useRouter()

const docId = ref(route.params.id as string)
const kbId = ref((route.query.kbId as string) || '')

const { data: doc, isLoading } = useDocument(kbId, docId)
const deleteMutation = useDeleteDocument()

const showVersionHistory = ref(false)
const downloadLoading = ref(false)

// --- 操作 ---

function goBack() {
  // 返回进入本页前的来源页（知识库详情 或 文档管理页），避免固定跳转到"文档管理"页；
  // 直接访问本页（无历史记录）时回退到文档管理页。
  if (window.history.state?.back) {
    router.back()
  } else {
    router.push({ name: 'Documents', query: { kbId: kbId.value } })
  }
}

async function handleDownload() {
  downloadLoading.value = true
  try {
    const result = await documentsApi.getDownloadUrl(kbId.value, docId.value)
    if (result.url) {
      window.open(result.url, '_blank')
    }
  } catch (err) {
    ElMessage.error(`获取下载链接失败: ${err instanceof Error ? err.message : String(err)}`)
  } finally {
    downloadLoading.value = false
  }
}

async function handleDelete() {
  try {
    await ElMessageBox.confirm(
      `确定要删除文档 "${(doc.value as Document)?.name}" 吗？`,
      '确认删除',
      { confirmButtonText: '删除', cancelButtonText: '取消', type: 'warning' },
    )
    await deleteMutation.mutateAsync({ kbId: kbId.value, id: docId.value })
    ElMessage.success('文档已删除')
    goBack()
  } catch {
    // 取消
  }
}

function handleReindex() {
  ElMessageBox.alert(
    '重新索引任务已提交，请前往任务列表查看进度。',
    '重新索引',
    { confirmButtonText: '知道了' },
  )
}

function formatSize(bytes: number): string {
  if (!bytes) return '-'
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  return (bytes / 1024 / 1024).toFixed(2) + ' MB'
}

function statusLabel(status: string): string {
  const map: Record<string, string> = {
    UPLOADING: '上传中', PROCESSING: '处理中', READY: '就绪',
    FAILED: '失败', DELETED: '已删除',
  }
  return map[status] || status
}

function statusTagType(status: string): 'success' | 'warning' | 'danger' | 'info' {
  const map: Record<string, 'success' | 'warning' | 'danger' | 'info'> = {
    READY: 'success', PROCESSING: 'warning', UPLOADING: 'warning',
    FAILED: 'danger', DELETED: 'info',
  }
  return map[status] || 'info'
}
</script>

<template>
  <div class="document-detail-page">
    <!-- 返回 -->
    <div class="back-row">
      <el-button
        :icon="ArrowLeft"
        text
        size="default"
        @click="goBack"
      >
        返回文档列表
      </el-button>
    </div>

    <div
      v-if="doc"
      class="detail-content"
    >
      <div v-loading="isLoading">
        <!-- 基本信息 -->
        <div class="detail-card">
          <div class="detail-header">
            <h2 class="detail-title">
              {{ (doc as Document).name }}
            </h2>
            <div class="detail-actions">
              <el-button
                :icon="Download"
                :loading="downloadLoading"
                @click="handleDownload"
              >
                下载
              </el-button>
              <el-button
                :icon="Refresh"
                @click="handleReindex"
              >
                重新索引
              </el-button>
              <el-button
                :icon="Delete"
                type="danger"
                @click="handleDelete"
              >
                删除
              </el-button>
            </div>
          </div>

          <el-descriptions
            :column="3"
            border
            size="small"
          >
            <el-descriptions-item label="原始文件名">
              {{ (doc as Document).originalName }}
            </el-descriptions-item>
            <el-descriptions-item label="MIME 类型">
              {{ (doc as Document).mimeType }}
            </el-descriptions-item>
            <el-descriptions-item label="文件大小">
              {{ formatSize(Number((doc as Document).fileSize)) }}
            </el-descriptions-item>
            <el-descriptions-item label="状态">
              <el-tag
                :type="statusTagType((doc as Document).status)"
                size="small"
              >
                {{ statusLabel((doc as Document).status) }}
              </el-tag>
            </el-descriptions-item>
            <el-descriptions-item label="分块数">
              {{ (doc as Document).chunkCount }}
            </el-descriptions-item>
            <el-descriptions-item label="页数">
              {{ (doc as Document).pageCount || '-' }}
            </el-descriptions-item>
            <el-descriptions-item label="上传者">
              {{ (doc as Document).user?.username || '-' }}
            </el-descriptions-item>
            <el-descriptions-item label="当前版本">
              <span v-if="(doc as Document).currentVersion">
                v{{ (doc as Document).currentVersion!.versionNumber }}
              </span>
              <span v-else>-</span>
            </el-descriptions-item>
            <el-descriptions-item label="上传时间">
              {{ dayjs((doc as Document).createdAt).format('YYYY-MM-DD HH:mm:ss') }}
            </el-descriptions-item>
          </el-descriptions>
        </div>

        <!-- 版本历史 -->
        <div class="detail-card">
          <div class="section-header">
            <h3>版本历史</h3>
            <el-button
              type="primary"
              size="small"
              @click="showVersionHistory = true"
            >
              查看版本历史 &amp; 切换版本
            </el-button>
          </div>
        </div>
      </div>

      <!-- 空状态 -->
      <el-empty
        v-if="!isLoading && !doc"
        description="文档不存在"
      />
    </div>

    <!-- 版本历史弹窗 -->
    <VersionHistory
      v-if="showVersionHistory && doc"
      :document="(doc as Document)"
      :kb-id="kbId"
      @close="showVersionHistory = false"
      @activated="showVersionHistory = false"
    />
  </div>
</template>

<style scoped>
.document-detail-page {
  padding: 0;
}
.back-row {
  margin-bottom: 16px;
}
.detail-content {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.detail-card {
  background: var(--bg-primary, #fff);
  border: 1px solid var(--border-color, #ebeef5);
  border-radius: 8px;
  padding: 20px;
}
.detail-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}
.detail-title {
  font-size: 20px;
  font-weight: 600;
  color: var(--foreground, #303133);
  margin: 0;
}
.detail-actions {
  display: flex;
  gap: 8px;
}
.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.section-header h3 {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: var(--foreground, #303133);
}
</style>
