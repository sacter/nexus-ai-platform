<script setup lang="ts">
import { useRouter } from 'vue-router'
import { Plus } from '@element-plus/icons-vue'
import { useWorkflows, useDeleteWorkflow } from '@/composables/use-workflows'
import WorkflowCard from '@/components/workflows/WorkflowCard.vue'
const router = useRouter()
const { data: wfs, isLoading } = useWorkflows()
const deleteMutation = useDeleteWorkflow()
function handleEdit(id: string) { router.push(`/workflows/${id}`) }
function handleExecute(id: string) { /* TODO */ }
function handleDelete(id: string) { deleteMutation.mutate(id) }
</script>
<template>
  <div>
    <div class="flex items-center justify-between mb-6">
      <h1 class="text-2xl font-semibold" style="color: var(--foreground)">Workflow</h1>
      <div class="flex gap-2">
        <el-button @click="router.push('/workflows/designer')">设计器</el-button>
        <el-button type="primary" :icon="Plus" @click="router.push('/workflows/new')">创建工作流</el-button>
      </div>
    </div>
    <div v-if="isLoading" class="flex justify-center py-12"><el-icon class="is-loading" :size="24"><Plus /></el-icon></div>
    <div v-else-if="wfs && Array.isArray(wfs) && wfs.length > 0" class="grid grid-cols-3 gap-4">
      <WorkflowCard v-for="wf in wfs" :key="(wf as any).id" :id="(wf as any).id" :name="(wf as any).name" @edit="handleEdit" @execute="handleExecute" @delete="handleDelete" />
    </div>
    <el-empty v-else description="暂无 Workflow" />
  </div>
</template>
