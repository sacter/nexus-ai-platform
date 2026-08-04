<script setup lang="ts">
import { ref } from 'vue'
import { Check, CircleCheck } from '@element-plus/icons-vue'
import dayjs from 'dayjs'
import {
  useDocumentVersions,
  useActivateVersion,
} from '@/modules/knowledge/composables/useDocuments'
import type { Document, DocumentVersion } from '@/modules/knowledge/types/document'

const props = defineProps<{
  document: Document
  kbId: string
}>()

const emit = defineEmits<{
  close: []
  activated: [version: DocumentVersion]
}>()

const { data: versions, isLoading } = useDocumentVersions(
  () => props.kbId,
  () => props.document.id,
)

const activateMutation = useActivateVersion()
const activatingId = ref<string | null>(null)

async function handleActivate(version: DocumentVersion) {
  activatingId.value = version.id
  try {
    await activateMutation.mutateAsync({
      kbId: props.kbId,
      docId: props.document.id,
      versionId: version.id,
    })
    emit('activated', version)
  } finally {
    activatingId.value = null
  }
}

function isCurrentVersion(version: DocumentVersion): boolean {
  return version.id === props.document.currentVersionId
}

function formatFileUrl(url: string): string {
  const parts = url.split('/')
  return parts[parts.length - 1] || url
}
</script>

<template>
  <el-dialog
    :model-value="true"
    :title="`版本历史 - ${document.name}`"
    width="700px"
    @close="emit('close')"
  >
    <div v-loading="isLoading" class="version-history">
      <el-timeline v-if="versions && versions.length > 0">
        <el-timeline-item
          v-for="version in (versions as DocumentVersion[])"
          :key="version.id"
          :timestamp="dayjs(version.createdAt).format('YYYY-MM-DD HH:mm:ss')"
          placement="top"
          :color="isCurrentVersion(version) ? 'var(--success, #67c23a)' : 'var(--primary, #409eff)'"
        >
          <div class="version-item">
            <div class="version-header">
              <el-tag
                :type="isCurrentVersion(version) ? 'success' : 'info'"
                size="small"
                effect="plain"
              >
                v{{ version.versionNumber }}
              </el-tag>
              <el-tag
                v-if="isCurrentVersion(version)"
                type="success"
                size="small"
                effect="dark"
              >
                <el-icon><CircleCheck /></el-icon>
                当前版本
              </el-tag>
              <el-tag
                :type="version.status === 'READY' ? 'success' : version.status === 'FAILED' ? 'danger' : 'warning'"
                size="small"
                effect="plain"
              >
                {{ version.status === 'READY' ? '就绪' : version.status === 'FAILED' ? '失败' : '处理中' }}
              </el-tag>
            </div>

            <div class="version-details">
              <p v-if="version.changeSummary" class="version-summary">
                {{ version.changeSummary }}
              </p>
              <div class="version-meta">
                <span>文件: {{ formatFileUrl(version.fileUrl) }}</span>
                <span>分块: {{ version.chunkCount }}</span>
                <span>页数: {{ version.pageCount }}</span>
                <span v-if="version.createdByUser">
                  上传者: {{ version.createdByUser.username }}
                </span>
              </div>
            </div>

            <div v-if="!isCurrentVersion(version)" class="version-action">
              <el-button
                type="primary"
                size="small"
                :loading="activatingId === version.id"
                @click="handleActivate(version)"
              >
                切换到此版本
              </el-button>
            </div>
          </div>
        </el-timeline-item>
      </el-timeline>

      <el-empty v-else description="暂无版本记录" />
    </div>
  </el-dialog>
</template>

<style scoped>
.version-history {
  max-height: 60vh;
  overflow-y: auto;
}
.version-item {
  padding: 4px 0;
}
.version-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}
.version-details {
  margin-bottom: 8px;
}
.version-summary {
  margin: 0 0 4px;
  font-size: 13px;
  color: var(--foreground-secondary, #606266);
}
.version-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  font-size: 12px;
  color: var(--foreground-secondary, #909399);
}
.version-action {
  margin-top: 8px;
}
</style>
