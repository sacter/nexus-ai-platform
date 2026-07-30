<script setup lang="ts">
import { reactive, ref } from 'vue'
import { useCreateKnowledgeBase } from '@/modules/knowledge/composables/useKnowledge'

const visible = defineModel<boolean>('visible', { default: false })

const form = reactive({
  name: '',
  description: '',
})

const createMutation = useCreateKnowledgeBase()
const submitting = ref(false)

async function handleSubmit() {
  if (!form.name.trim()) return
  submitting.value = true
  try {
    await createMutation.mutateAsync(form)
    visible.value = false
    form.name = ''
    form.description = ''
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <el-dialog v-model="visible" title="创建知识库" width="480px">
    <el-form @submit.prevent="handleSubmit">
      <el-form-item label="名称" required>
        <el-input v-model="form.name" placeholder="知识库名称" />
      </el-form-item>
      <el-form-item label="描述">
        <el-input v-model="form.description" type="textarea" placeholder="知识库描述（可选）" />
      </el-form-item>
    </el-form>
    <template #footer>
      <el-button @click="visible = false">取消</el-button>
      <el-button type="primary" :loading="submitting" @click="handleSubmit">创建</el-button>
    </template>
  </el-dialog>
</template>
