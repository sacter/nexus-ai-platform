<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { Plus, Delete } from '@element-plus/icons-vue'
import { apiKeysApi } from '@/modules/system/api/api-keys.api'
const keys = ref<unknown[]>([])
const loading = ref(false)
onMounted(async () => { loading.value = true; try { const data = await apiKeysApi.list(); keys.value = data as unknown[] } finally { loading.value = false } })
async function handleCreate() { try { await apiKeysApi.create({ name: 'New Key' }); const data = await apiKeysApi.list(); keys.value = data as unknown[] } catch { /* 忽略创建失败 */ } }
async function handleDelete(id: string) { try { await apiKeysApi.delete(id); keys.value = keys.value.filter((k) => (k as { id: string }).id !== id) } catch { /* 忽略删除失败 */ } }
</script>
<template>
  <div>
    <div class="flex items-center justify-between mb-6">
      <h1
        class="text-2xl font-semibold"
        style="color: var(--foreground)"
      >
        API Keys
      </h1><el-button
        type="primary"
        :icon="Plus"
        @click="handleCreate"
      >
        创建 Key
      </el-button>
    </div>
    <el-table
      v-loading="loading"
      :data="keys"
      stripe
    >
      <el-table-column
        prop="name"
        label="名称"
      />
      <el-table-column
        prop="key"
        label="Key"
        min-width="200"
      >
        <template #default="{ row }">
          <code class="text-xs">{{ (row as any).key }}</code>
        </template>
      </el-table-column>
      <el-table-column
        prop="createdAt"
        label="创建时间"
        width="160"
      />
      <el-table-column
        label="操作"
        width="100"
      >
        <template #default="{ row }">
          <el-button
            :icon="Delete"
            size="small"
            type="danger"
            text
            @click="handleDelete((row as any).id)"
          />
        </template>
      </el-table-column>
    </el-table>
  </div>
</template>
