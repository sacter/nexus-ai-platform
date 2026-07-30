<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { Plus, Delete } from '@element-plus/icons-vue'
import { apiKeysApi } from '@/api/api-keys'
const keys = ref<unknown[]>([])
const loading = ref(false)
onMounted(async () => { loading.value = true; try { const data = await apiKeysApi.list(); keys.value = data as unknown[] } finally { loading.value = false } })
async function handleCreate() { try { await apiKeysApi.create({ name: 'New Key' }); const data = await apiKeysApi.list(); keys.value = data as unknown[] } catch {} }
async function handleDelete(id: string) { try { await apiKeysApi.delete(id); keys.value = keys.value.filter((k: any) => k.id !== id) } catch {} }
</script>
<template>
  <div>
    <div class="flex items-center justify-between mb-6"><h1 class="text-2xl font-semibold" style="color: var(--foreground)">API Keys</h1><el-button type="primary" :icon="Plus" @click="handleCreate">创建 Key</el-button></div>
    <el-table :data="keys" v-loading="loading" stripe>
      <el-table-column prop="name" label="名称" />
      <el-table-column prop="key" label="Key" min-width="200"><template #default="{ row }"><code class="text-xs">{{ (row as any).key }}</code></template></el-table-column>
      <el-table-column prop="createdAt" label="创建时间" width="160" />
      <el-table-column label="操作" width="100"><template #default="{ row }"><el-button :icon="Delete" size="small" type="danger" text @click="handleDelete((row as any).id)" /></template></el-table-column>
    </el-table>
  </div>
</template>
