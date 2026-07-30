<script setup lang="ts">
import { ref } from 'vue'
import { Upload } from '@element-plus/icons-vue'
import { useUploadDocument } from '@/modules/knowledge/composables/useDocuments'

const props = defineProps<{
  kbId: string
}>()

const uploadRef = ref()
const uploadMutation = useUploadDocument()

function handleChange(file: unknown, fileList: unknown[]) {
  const f = file as { raw: File; name: string }
  const formData = new FormData()
  formData.append('file', f.raw, f.name)
  uploadMutation.mutate({ kbId: props.kbId, formData })
}
</script>

<template>
  <el-upload
    ref="uploadRef"
    drag
    :auto-upload="false"
    :on-change="handleChange"
    :show-file-list="true"
  >
    <el-icon class="is-loading" :size="24" v-if="uploadMutation.isPending.value"><Upload /></el-icon>
    <el-icon :size="24" v-else><Upload /></el-icon>
    <div class="text-sm mt-2" style="color: var(--foreground); opacity: 0.6">
      拖拽文件到此处或点击上传
    </div>
  </el-upload>
</template>
