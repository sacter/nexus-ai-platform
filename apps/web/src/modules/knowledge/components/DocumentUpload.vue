<script setup lang="ts">
import { ref, watch } from 'vue'
import {
  Upload,
  Close,
  UploadFilled,
  CircleCheckFilled,
  CircleCloseFilled,
  RefreshRight,
  Delete,
} from '@element-plus/icons-vue'
import { useUpload } from '@/modules/knowledge/composables/useUpload'
import type { UploadFileItem } from '@/modules/knowledge/types/document'

const props = defineProps<{ kbId: string }>()

const emit = defineEmits<{
  uploaded: []
}>()

const {
  fileList,
  uploading,
  pendingCount,
  uploadingCount,
  successCount,
  failedCount,
  addFiles,
  removeFile,
  clearCompleted,
  setFileName,
  startUpload,
  retryFailed,
} = useUpload(props.kbId)

const dragOver = ref(false)
const fileInputRef = ref<HTMLInputElement>()
const editingId = ref<string | null>(null)
const editingName = ref('')

// --- 拖拽事件 ---
function onDragOver(e: DragEvent) {
  e.preventDefault()
  dragOver.value = true
}
function onDragLeave() {
  dragOver.value = false
}
function onDrop(e: DragEvent) {
  e.preventDefault()
  dragOver.value = false
  if (e.dataTransfer?.files && e.dataTransfer.files.length > 0) {
    addFiles(e.dataTransfer.files)
  }
}

// --- 文件选择 ---
function onFileInputChange(e: Event) {
  const files = (e.target as HTMLInputElement).files
  if (files && files.length > 0) {
    addFiles(files)
    // 重置 input 以允许重新选择相同文件
    ;(e.target as HTMLInputElement).value = ''
  }
}

// --- 文件名编辑 ---
function startEditName(item: UploadFileItem) {
  editingId.value = item.id
  editingName.value = item.name
}
function finishEditName(item: UploadFileItem) {
  if (editingName.value.trim()) {
    setFileName(item.id, editingName.value.trim())
  }
  editingId.value = null
}

// --- 上传 ---
async function handleUpload() {
  await startUpload()
  emit('uploaded')
}

// --- 状态图标 ---
function statusIcon(status: UploadFileItem['status']) {
  switch (status) {
    case 'success': return CircleCheckFilled
    case 'failed': return CircleCloseFilled
    case 'uploading': return UploadFilled
    default: return null
  }
}
function statusColor(status: UploadFileItem['status']) {
  switch (status) {
    case 'success': return 'var(--success, #67c23a)'
    case 'failed': return 'var(--danger, #f56c6c)'
    case 'uploading': return 'var(--primary, #409eff)'
    default: return 'var(--info, #909399)'
  }
}

// Reset state when kbId changes
watch(() => props.kbId, () => {
  fileList.value = []
})
</script>

<template>
  <div class="document-upload">
    <!-- 拖拽区 -->
    <div
      class="upload-dropzone"
      :class="{ 'is-dragover': dragOver }"
      @dragover="onDragOver"
      @dragleave="onDragLeave"
      @drop="onDrop"
      @click="fileInputRef?.click()"
    >
      <el-icon :size="32"><Upload /></el-icon>
      <p class="upload-text">拖拽文件到此处，或点击选择文件</p>
      <p class="upload-hint">
        支持 PDF、Word、Excel、PPT、Markdown、TXT | 单文件上限 500MB
      </p>
      <input
        ref="fileInputRef"
        type="file"
        multiple
        accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.md,.txt"
        class="upload-input-hidden"
        @change="onFileInputChange"
      />
    </div>

    <!-- 文件列表 -->
    <div v-if="fileList.length > 0" class="upload-file-list">
      <div class="upload-file-header">
        <span class="upload-count">
          共 {{ fileList.length }} 个文件
          <template v-if="successCount > 0">({{ successCount }} 成功)</template>
          <template v-if="failedCount > 0">({{ failedCount }} 失败)</template>
        </span>
        <span class="upload-actions-header">
          <el-button
            v-if="failedCount > 0"
            type="warning"
            size="small"
            :icon="RefreshRight"
            text
            @click="retryFailed"
          >
            重试失败
          </el-button>
          <el-button
            type="primary"
            size="small"
            :loading="uploading"
            :disabled="pendingCount === 0"
            @click="handleUpload"
          >
            {{ uploading ? `上传中 (${uploadingCount + successCount}/${fileList.length})` : `开始上传 (${pendingCount})` }}
          </el-button>
          <el-button
            v-if="successCount > 0 || failedCount > 0"
            size="small"
            text
            @click="clearCompleted"
          >
            清理已完成
          </el-button>
        </span>
      </div>

      <div
        v-for="item in fileList"
        :key="item.id"
        class="upload-file-item"
      >
        <!-- 状态图标 -->
        <component
          :is="statusIcon(item.status)"
          v-if="statusIcon(item.status)"
          class="upload-status-icon"
          :style="{ color: statusColor(item.status) }"
        />

        <!-- 文件信息 -->
        <div class="upload-file-info">
          <div class="upload-file-name-row">
            <!-- 可编辑文件名（用于版本分组） -->
            <template v-if="editingId === item.id">
              <el-input
                v-model="editingName"
                size="small"
                class="upload-name-input"
                @blur="finishEditName(item)"
                @keyup.enter="finishEditName(item)"
              />
            </template>
            <template v-else>
              <span
                class="upload-file-name"
                :class="{ 'is-editable': item.status === 'pending' }"
                :title="'点击编辑文档名称（用于版本分组）'"
                @click="item.status === 'pending' && startEditName(item)"
              >
                {{ item.name }}
              </span>
            </template>
            <span class="upload-file-original">({{ item.file.name }})</span>
          </div>
          <div class="upload-file-meta">
            <span>{{ (item.file.size / 1024 / 1024).toFixed(2) }} MB</span>
            <span v-if="item.status === 'failed'" class="upload-error">
              {{ item.error }}
            </span>
          </div>
          <!-- 进度条 -->
          <el-progress
            v-if="item.status === 'uploading'"
            :percentage="item.progress"
            :stroke-width="4"
            :show-text="true"
            style="margin-top: 4px"
          />
        </div>

        <!-- 操作 -->
        <el-button
          v-if="item.status === 'pending' || item.status === 'failed'"
          :icon="Close"
          size="small"
          text
          type="danger"
          @click="removeFile(item.id)"
        />
      </div>
    </div>
  </div>
</template>

<style scoped>
.document-upload {
  width: 100%;
}

.upload-dropzone {
  border: 2px dashed var(--border-color, #dcdfe6);
  border-radius: 8px;
  padding: 32px 16px;
  text-align: center;
  cursor: pointer;
  transition: border-color 0.3s, background 0.3s;
  background: var(--bg-secondary, #fafafa);
}
.upload-dropzone:hover,
.upload-dropzone.is-dragover {
  border-color: var(--primary, #409eff);
  background: var(--primary-light, rgba(64, 158, 255, 0.05));
}
.upload-text {
  margin: 8px 0 4px;
  font-size: 14px;
  color: var(--foreground, #303133);
}
.upload-hint {
  margin: 0;
  font-size: 12px;
  color: var(--foreground-secondary, #909399);
}
.upload-input-hidden {
  display: none;
}

.upload-file-list {
  margin-top: 16px;
  border: 1px solid var(--border-color, #ebeef5);
  border-radius: 8px;
  overflow: hidden;
}
.upload-file-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 12px;
  background: var(--bg-secondary, #f5f7fa);
  border-bottom: 1px solid var(--border-color, #ebeef5);
}
.upload-count {
  font-size: 13px;
  color: var(--foreground-secondary, #606266);
}
.upload-actions-header {
  display: flex;
  gap: 4px;
  align-items: center;
}

.upload-file-item {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 10px 12px;
  border-bottom: 1px solid var(--border-light, #f2f3f5);
}
.upload-file-item:last-child {
  border-bottom: none;
}
.upload-status-icon {
  flex-shrink: 0;
  margin-top: 2px;
  font-size: 18px;
}
.upload-file-info {
  flex: 1;
  min-width: 0;
}
.upload-file-name-row {
  display: flex;
  align-items: center;
  gap: 6px;
}
.upload-file-name {
  font-size: 14px;
  font-weight: 500;
  color: var(--foreground, #303133);
  max-width: 300px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.upload-file-name.is-editable {
  cursor: pointer;
  border-bottom: 1px dashed var(--info, #909399);
}
.upload-file-name.is-editable:hover {
  color: var(--primary, #409eff);
}
.upload-name-input {
  max-width: 260px;
}
.upload-file-original {
  font-size: 12px;
  color: var(--foreground-secondary, #909399);
}
.upload-file-meta {
  margin-top: 2px;
  font-size: 12px;
  color: var(--foreground-secondary, #909399);
  display: flex;
  gap: 12px;
}
.upload-error {
  color: var(--danger, #f56c6c);
}
</style>
