<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { auditLogsApi } from '@/modules/system/api/audit-logs.api'
const logs = ref<unknown[]>([])
const loading = ref(false)
onMounted(async () => { loading.value = true; try { const data = await auditLogsApi.list(); logs.value = data as unknown[] } finally { loading.value = false } })
</script>
<template>
  <div>
    <h1
      class="text-2xl font-semibold mb-6"
      style="color: var(--foreground)"
    >
      审计日志
    </h1>
    <el-table
      v-loading="loading"
      :data="logs"
      stripe
    >
      <el-table-column
        prop="action"
        label="操作"
        width="150"
      >
        <template #default="{ row }">
          <el-tag size="small">
            {{ (row as any).action }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column
        prop="userId"
        label="用户"
        width="120"
      />
      <el-table-column
        prop="resource"
        label="资源"
        width="150"
      />
      <el-table-column
        prop="detail"
        label="详情"
        min-width="200"
      />
      <el-table-column
        prop="createdAt"
        label="时间"
        width="160"
      />
    </el-table>
  </div>
</template>
