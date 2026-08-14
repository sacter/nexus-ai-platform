<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { Lock } from '@element-plus/icons-vue'
import { auditLogsApi } from '@/modules/system/api/audit-logs.api'
const logs = ref<unknown[]>([])
const loading = ref(false)
onMounted(async () => { loading.value = true; try { const data = await auditLogsApi.list(); logs.value = data as unknown[] } finally { loading.value = false } })
</script>
<template>
  <div>
    <div class="mb-6 flex items-center gap-3">
      <div
        class="flex h-10 w-10 items-center justify-center rounded-xl shrink-0"
        style="background: var(--brand-gradient); box-shadow: 0 8px 20px -8px color-mix(in oklch, var(--accent) 55%, transparent)"
      >
        <el-icon
          :size="18"
          color="#fff"
        >
          <Lock />
        </el-icon>
      </div>
      <div>
        <h1
          class="font-display text-2xl font-bold tracking-tight"
          style="color: var(--foreground)"
        >
          审计日志
        </h1>
        <p
          class="mt-0.5 text-xs"
          style="color: var(--foreground); opacity: 0.55"
        >
          查看平台关键操作审计记录
        </p>
      </div>
    </div>
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
