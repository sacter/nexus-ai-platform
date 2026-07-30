<script setup lang="ts">
import { Plus } from '@element-plus/icons-vue'
import { useTools, useDeleteTool } from '@/composables/use-tools'
import ToolCard from '@/components/tools/ToolCard.vue'
const { data: tools, isLoading } = useTools()
const deleteMutation = useDeleteTool()
function handleDelete(id: string) { deleteMutation.mutate(id) }
</script>
<template>
  <div>
    <div class="flex items-center justify-between mb-6">
      <h1 class="text-2xl font-semibold" style="color: var(--foreground)">工具</h1>
      <el-button type="primary" :icon="Plus">添加工具</el-button>
    </div>
    <div v-if="isLoading" class="flex justify-center py-12"><el-icon class="is-loading" :size="24"><Plus /></el-icon></div>
    <div v-else-if="tools && Array.isArray(tools) && tools.length > 0" class="grid grid-cols-3 gap-4">
      <ToolCard v-for="t in tools" :key="(t as any).id" :id="(t as any).id" :name="(t as any).name" :description="(t as any).description" :type="(t as any).type" @delete="handleDelete" />
    </div>
    <el-empty v-else description="暂无工具" />
  </div>
</template>
