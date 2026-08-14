<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { Plus, Delete, Edit, EditPen } from '@element-plus/icons-vue'
import { promptsApi } from '@/modules/prompt/api/prompt.api'
const prompts = ref<unknown[]>([])
const loading = ref(false)
onMounted(async () => { loading.value = true; try { const data = await promptsApi.list(); prompts.value = data as unknown[] } finally { loading.value = false } })
async function handleDelete(id: string) { try { await promptsApi.delete(id); prompts.value = prompts.value.filter((p) => (p as { id: string }).id !== id) } catch { /* 忽略删除失败 */ } }
</script>
<template>
  <div>
    <div class="mb-6 flex items-center justify-between">
      <div class="flex items-center gap-3">
        <div
          class="flex h-10 w-10 items-center justify-center rounded-xl shrink-0"
          style="background: var(--brand-gradient); box-shadow: 0 8px 20px -8px color-mix(in oklch, var(--accent) 55%, transparent)"
        >
          <el-icon
            :size="18"
            color="#fff"
          >
            <EditPen />
          </el-icon>
        </div>
        <div>
          <h1
            class="font-display text-2xl font-bold tracking-tight"
            style="color: var(--foreground)"
          >
            提示词
          </h1>
          <p
            class="mt-0.5 text-xs"
            style="color: var(--foreground); opacity: 0.55"
          >
            维护可复用的提示词模板
          </p>
        </div>
      </div>
      <el-button
        type="primary"
        :icon="Plus"
      >
        新建提示词
      </el-button>
    </div>
    <el-table
      v-loading="loading"
      :data="prompts"
      stripe
    >
      <el-table-column
        prop="name"
        label="名称"
      />
      <el-table-column
        prop="content"
        label="内容"
        min-width="300"
      >
        <template #default="{ row }">
          <span
            class="text-sm"
            style="opacity: 0.6"
          >{{ ((row as any).content || '').slice(0, 80) }}{{ ((row as any).content || '').length > 80 ? '...' : '' }}</span>
        </template>
      </el-table-column>
      <el-table-column
        prop="updatedAt"
        label="更新时间"
        width="160"
      />
      <el-table-column
        label="操作"
        width="120"
      >
        <template #default="{ row }">
          <el-button
            :icon="Edit"
            size="small"
            text
          /><el-button
            :icon="Delete"
            size="small"
            text
            @click="handleDelete((row as any).id)"
          />
        </template>
      </el-table-column>
    </el-table>
  </div>
</template>
