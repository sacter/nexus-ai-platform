<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { Plus, Delete, Edit } from '@element-plus/icons-vue'
import { promptsApi } from '@/modules/prompt/api/prompt.api'
const prompts = ref<unknown[]>([])
const loading = ref(false)
onMounted(async () => { loading.value = true; try { const data = await promptsApi.list(); prompts.value = data as unknown[] } finally { loading.value = false } })
async function handleDelete(id: string) { try { await promptsApi.delete(id); prompts.value = prompts.value.filter((p: any) => p.id !== id) } catch {} }
</script>
<template>
  <div>
    <div class="flex items-center justify-between mb-6"><h1 class="text-2xl font-semibold" style="color: var(--foreground)">提示词</h1><el-button type="primary" :icon="Plus">新建提示词</el-button></div>
    <el-table :data="prompts" v-loading="loading" stripe>
      <el-table-column prop="name" label="名称" />
      <el-table-column prop="content" label="内容" min-width="300"><template #default="{ row }"><span class="text-sm" style="opacity: 0.6">{{ ((row as any).content || '').slice(0, 80) }}{{ ((row as any).content || '').length > 80 ? '...' : '' }}</span></template></el-table-column>
      <el-table-column prop="updatedAt" label="更新时间" width="160" />
      <el-table-column label="操作" width="120"><template #default="{ row }"><el-button :icon="Edit" size="small" text /><el-button :icon="Delete" size="small" text @click="handleDelete((row as any).id)" /></template></el-table-column>
    </el-table>
  </div>
</template>
