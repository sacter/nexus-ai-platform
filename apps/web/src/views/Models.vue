<script setup lang="ts">
import { Plus } from '@element-plus/icons-vue'
import { useModels, useDeleteModel } from '@/composables/use-models'
import ModelCard from '@/components/models/ModelCard.vue'
const { data: models, isLoading } = useModels()
const deleteMutation = useDeleteModel()
function handleDelete(id: string) { deleteMutation.mutate(id) }
</script>
<template>
  <div>
    <div class="flex items-center justify-between mb-6">
      <h1 class="text-2xl font-semibold" style="color: var(--foreground)">模型</h1>
      <el-button type="primary" :icon="Plus">添加模型</el-button>
    </div>
    <div v-if="isLoading" class="flex justify-center py-12"><el-icon class="is-loading" :size="24"><Plus /></el-icon></div>
    <div v-else-if="models && Array.isArray(models) && models.length > 0" class="grid grid-cols-3 gap-4">
      <ModelCard v-for="m in models" :key="(m as any).id" :id="(m as any).id" :name="(m as any).name" :provider="(m as any).provider" :type="(m as any).type" @delete="handleDelete" />
    </div>
    <el-empty v-else description="暂无模型" />
  </div>
</template>
