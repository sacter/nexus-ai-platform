<script setup lang="ts">
import { ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessageBox } from 'element-plus'
import {
  useDocuments,
  useDeleteDocument,
  useDownloadUrl,
} from '@/modules/knowledge/composables/useDocuments'
import DocumentTable from '@/modules/knowledge/components/DocumentTable.vue'
import DocumentUpload from '@/modules/knowledge/components/DocumentUpload.vue'
import VersionHistory from '@/modules/knowledge/components/VersionHistory.vue'
import type { Document } from '@/modules/knowledge/types/document'

const route = useRoute()
const router = useRouter()
const kbId = ref((route.query.kbId as string) || '')

const { data: docs, isLoading, refetch } = useDocuments(kbId)
const deleteMutation = useDeleteDocument()

// 版本历史弹窗
const versionHistoryDoc = ref<Document | null>(null)

// 下载
const downloadDocId = ref<string | null>(null)
const { data: downloadData, refetch: fetchDownloadUrl } = useDownloadUrl(
  kbId,
  () => downloadDocId.value || '',
)

// --- 操作处理 ---

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

async function handleDelete(doc: Document) {
  try {
    await ElMessageBox.confirm(
      `确定要删除文档 "${doc.name}" 吗？此操作为软删除，可联系管理员恢复。`,
      '确认删除',
      { confirmButtonText: '删除', cancelButtonText: '取消', type: 'warning' },
    )
    await deleteMutation.mutateAsync({ kbId: kbId.value, id: doc.id })
  } catch {
    // 用户取消
  }
}

function handleVersionHistory(doc: Document) {
  versionHistoryDoc.value = doc
}

function handleReindex(doc: Document) {
  ElMessageBox.alert(
    `文档 "${doc.name}" 的重新索引功能将通过后台任务执行，请前往任务列表查看进度。`,
    '重新索引',
    { confirmButtonText: '知道了' },
  )
}

function handleUploaded() {
  refetch()
}
</script>

<template>
  <div class="document-list-page">
    <div class="page-header">
      <h1 class="page-title">文档管理</h1>
    </div>

    <!-- 上传区 -->
    <div class="upload-section">
      <DocumentUpload
        :kb-id="kbId"
        @uploaded="handleUploaded"
      />
    </div>

    <!-- 文档列表 -->
    <div class="table-section">
      <DocumentTable
        :documents="(docs as Document[]) || []"
        :loading="isLoading"
        :kb-id="kbId"
        @view="handleView"
        @download="handleDownload"
        @delete="handleDelete"
        @version-history="handleVersionHistory"
        @reindex="handleReindex"
      />
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
</style>
