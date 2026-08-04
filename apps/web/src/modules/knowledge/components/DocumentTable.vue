<script setup lang="ts">
import { ref } from 'vue'
import {
  Delete,
  Download,
  View,
  Clock,
  SwitchButton,
  Refresh,
  MoreFilled,
} from '@element-plus/icons-vue'
import dayjs from 'dayjs'
import type { Document } from '@/modules/knowledge/types/document'

const props = defineProps<{
  documents: Document[]
  loading?: boolean
  kbId: string
}>()

const emit = defineEmits<{
  view: [doc: Document]
  download: [doc: Document]
  delete: [doc: Document]
  versionHistory: [doc: Document]
  activateVersion: [doc: Document]
  reindex: [doc: Document]
}>()

// 版本切换弹窗
const versionDialogVisible = ref(false)
const selectedDoc = ref<Document | null>(null)

function openVersionDialog(doc: Document) {
  selectedDoc.value = doc
  versionDialogVisible.value = true
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  return (bytes / 1024 / 1024).toFixed(2) + ' MB'
}

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
</script>

<template>
  <div class="document-table-wrap">
    <el-table
      :data="documents"
      v-loading="loading"
      stripe
      empty-text="暂无文档，请上传文件"
      table-layout="auto"
    >
      <!-- 文档名称 -->
      <el-table-column label="文档名称" min-width="220" show-overflow-tooltip>
        <template #default="{ row }">
          <div class="doc-name-cell">
            <span class="doc-name">{{ (row as Document).name }}</span>
            <span v-if="(row as Document).currentVersion" class="doc-version-tag">
              v{{ (row as Document).currentVersion!.versionNumber }}
            </span>
          </div>
        </template>
      </el-table-column>

      <!-- 类型 -->
      <el-table-column label="类型" width="80" align="center">
        <template #default="{ row }">
          <span class="doc-type-tag">
            {{ mimeTypeLabel((row as Document).mimeType) }}
          </span>
        </template>
      </el-table-column>

      <!-- 大小 -->
      <el-table-column label="大小" width="100" align="right">
        <template #default="{ row }">
          {{ formatSize(Number((row as Document).fileSize)) }}
        </template>
      </el-table-column>

      <!-- 状态 -->
      <el-table-column label="状态" width="100" align="center">
        <template #default="{ row }">
          <el-tag
            :type="statusTagType((row as Document).status)"
            size="small"
            effect="plain"
          >
            {{ statusLabel((row as Document).status) }}
          </el-tag>
        </template>
      </el-table-column>

      <!-- 分块数 -->
      <el-table-column label="分块" width="70" align="center">
        <template #default="{ row }">
          {{ (row as Document).chunkCount }}
        </template>
      </el-table-column>

      <!-- 上传者 -->
      <el-table-column label="上传者" width="100">
        <template #default="{ row }">
          {{ (row as Document).user?.username || '-' }}
        </template>
      </el-table-column>

      <!-- 时间 -->
      <el-table-column label="上传时间" width="160">
        <template #default="{ row }">
          {{ dayjs((row as Document).createdAt).format('YYYY-MM-DD HH:mm') }}
        </template>
      </el-table-column>

      <!-- 操作 -->
      <el-table-column label="操作" width="240" fixed="right">
        <template #default="{ row }">
          <div class="doc-actions">
            <el-tooltip content="预览">
              <el-button
                :icon="View"
                size="small"
                text
                @click="emit('view', row as Document)"
              />
            </el-tooltip>
            <el-tooltip content="下载">
              <el-button
                :icon="Download"
                size="small"
                text
                @click="emit('download', row as Document)"
              />
            </el-tooltip>
            <el-tooltip content="版本历史">
              <el-button
                :icon="Clock"
                size="small"
                text
                @click="emit('versionHistory', row as Document)"
              />
            </el-tooltip>
            <el-tooltip content="重新索引">
              <el-button
                :icon="Refresh"
                size="small"
                text
                @click="emit('reindex', row as Document)"
              />
            </el-tooltip>
            <el-tooltip content="删除">
              <el-button
                :icon="Delete"
                size="small"
                text
                type="danger"
                @click="emit('delete', row as Document)"
              />
            </el-tooltip>
          </div>
        </template>
      </el-table-column>
    </el-table>
  </div>
</template>

<style scoped>
.document-table-wrap {
  width: 100%;
}
.doc-name-cell {
  display: flex;
  align-items: center;
  gap: 6px;
}
.doc-name {
  font-weight: 500;
}
.doc-version-tag {
  font-size: 11px;
  color: var(--foreground-secondary, #909399);
  background: var(--bg-secondary, #f0f2f5);
  padding: 0 4px;
  border-radius: 3px;
  flex-shrink: 0;
}
.doc-type-tag {
  font-size: 12px;
  color: var(--foreground-secondary, #606266);
  background: var(--bg-secondary, #f0f2f5);
  padding: 1px 6px;
  border-radius: 4px;
}
.doc-actions {
  display: flex;
  gap: 0;
  align-items: center;
}
</style>
