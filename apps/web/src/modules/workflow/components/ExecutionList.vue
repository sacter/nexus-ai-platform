<script setup lang="ts">
import { computed } from 'vue'
import { Loading } from '@element-plus/icons-vue'
import type { WorkflowExecution } from '../types/workflow'
import { executionStatusMeta } from '../types/workflow'
import { formatDate } from '@/utils/format'

const props = defineProps<{
  executions?: WorkflowExecution[]
  loading?: boolean
}>()

const emit = defineEmits<{ viewDetail: [exec: WorkflowExecution] }>()

const rows = computed(() => props.executions ?? [])

function formatDuration(ms: number | null | undefined): string {
  if (ms == null) return '—'
  if (ms < 1000) return `${ms}ms`
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`
  const m = Math.floor(ms / 60_000)
  const s = ((ms % 60_000) / 1000).toFixed(0)
  return `${m}m ${s}s`
}

/** input JSON 提取首段文本作预览 */
function inputPreview(input: unknown): string {
  if (!input || typeof input !== 'object') return '—'
  const obj = input as Record<string, unknown>
  const cand = obj.query ?? obj.question ?? obj.input ?? obj.text ?? obj.prompt
  if (typeof cand === 'string') return cand.trim() || '—'
  // fallback：秀丽序列化首尾 100 字
  try {
    const s = JSON.stringify(obj)
    return s.length > 100 ? s.slice(0, 100) + '…' : s
  } catch {
    return '—'
  }
}
</script>

<template>
  <el-table
    v-loading="loading"
    :data="rows"
    stripe
    :show-header="rows.length > 0"
    empty-text="暂无执行记录"
  >
    <el-table-column
      label="开始时间"
      width="170"
    >
      <template #default="{ row }">
        {{ formatDate(row.startedAt ?? row.createdAt) }}
      </template>
    </el-table-column>
    <el-table-column
      label="状态"
      width="120"
    >
      <template #default="{ row }">
        <el-tag
          :type="executionStatusMeta(row.status).tagType"
          size="small"
          effect="light"
        >
          <el-icon
            v-if="row.status === 'RUNNING'"
            class="is-loading mr-1"
            :size="12"
          >
            <Loading />
          </el-icon>
          {{ executionStatusMeta(row.status).label }}
        </el-tag>
      </template>
    </el-table-column>
    <el-table-column
      label="耗时"
      width="100"
    >
      <template #default="{ row }">
        {{ formatDuration(row.durationMs) }}
      </template>
    </el-table-column>
    <el-table-column label="输入">
      <template #default="{ row }">
        <span
          class="line-clamp-1"
          style="color: var(--foreground); opacity: 0.75"
        >
          {{ inputPreview(row.input) }}
        </span>
      </template>
    </el-table-column>
    <el-table-column
      label="节点步骤"
      width="100"
      align="center"
    >
      <template #default="{ row }">
        {{ Array.isArray(row.nodeSteps) ? row.nodeSteps.length : 0 }} 步
      </template>
    </el-table-column>
    <el-table-column
      width="90"
      align="center"
      fixed="right"
    >
      <template #default="{ row }">
        <el-button
          text
          size="small"
          type="primary"
          @click="emit('viewDetail', row)"
        >
          详情
        </el-button>
      </template>
    </el-table-column>
  </el-table>
</template>
