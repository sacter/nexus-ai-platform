<script setup lang="ts">
import { reactive, ref } from 'vue'
import { useCreateModel } from '@/modules/models/composables/useModels'
const visible = defineModel<boolean>('visible', { default: false })
const form = reactive({ name: '', provider: '', type: '', apiKey: '', baseUrl: '' })
const createMutation = useCreateModel()
const submitting = ref(false)
async function handleSubmit() { submitting.value = true; try { await createMutation.mutateAsync(form); visible.value = false } finally { submitting.value = false } }
</script>
<template>
  <el-dialog v-model="visible" title="添加模型" width="480px">
    <el-form @submit.prevent="handleSubmit">
      <el-form-item label="名称" required><el-input v-model="form.name" /></el-form-item>
      <el-form-item label="提供商" required><el-input v-model="form.provider" /></el-form-item>
      <el-form-item label="类型"><el-input v-model="form.type" /></el-form-item>
      <el-form-item label="API Key"><el-input v-model="form.apiKey" type="password" show-password /></el-form-item>
      <el-form-item label="Base URL"><el-input v-model="form.baseUrl" /></el-form-item>
    </el-form>
    <template #footer>
      <el-button @click="visible = false">取消</el-button>
      <el-button type="primary" :loading="submitting" @click="handleSubmit">添加</el-button>
    </template>
  </el-dialog>
</template>
