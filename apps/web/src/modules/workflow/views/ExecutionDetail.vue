<script setup lang="ts">
import { computed, onUnmounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ArrowLeft, Refresh } from '@element-plus/icons-vue'
import { useWorkflow, useWorkflowExecution } from '@/modules/workflow/composables/useWorkflow'
import {
  executionStatusMeta,
  WORKFLOW_NODE_TYPE_LABELS,
} from '@/modules/workflow/types/workflow'
import { formatDate } from '@/utils/format'

const route = useRoute()
const router = useRouter()

const wfId = computed(() => String(route.params.id ?? ''))
const execId = computed(() => String(route.params.execId ?? ''))

const { data: wf } = useWorkflow(wfId)
const {
  data: exec,
  isLoading,
  refetch,
} = useWorkflowExecution(wfId, execId)

/** 运行中时每 2s 轮询一次 */
let poller: ReturnType<typeof setInterval> | null = null
watch(
  () => exec.value?.status,
  (status) => {
    if (poller) {
      clearInterval(poller)
      poller = null
    }
    if (status === 'RUNNING' || status === 'WAITING') {
      poller = setInterval(() => refetch(), 2000)
    }
  },
  { immediate: true },
)
onUnmounted(() => {
  if (poller) clearInterval(poller)
})

const statusMeta = computed(() =>
  exec.value ? executionStatusMeta(exec.value.status) : null,
)

const inputText = computed(() => JSON.stringify(exec.value?.input ?? {}, null, 2))
const outputText = computed(() =>
  exec.value?.output != null ? JSON.stringify(exec.value.output, null, 2) : '',
)

function formatDuration(ms: number | null | undefined): string {
  if (ms == null) return '—'
  if (ms < 1000) return `${ms}ms`
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`
  const m = Math.floor(ms / 60_000)
  const s = ((ms % 60_000) / 1000).toFixed(0)
  return `${m}m ${s}s`
}

function stepTagType(status: string): 'success' | 'warning' | 'danger' | 'info' | 'primary' {
  if (status === 'COMPLETED') return 'success'
  if (status === 'FAILED') return 'danger'
  if (status === 'RUNNING') return 'primary'
  return 'info'
}
</script>

<template>
  <div>
    <el-skeleton
      v-if="isLoading"
      animated
      :rows="8"
    />

    <template v-else-if="exec">
      <div class="mb-4">
        <el-button
          text
          :icon="ArrowLeft"
          @click="router.push(`/workflows/${wfId}`)"
        >
          返回详情
        </el-button>
      </div>

      <div class="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <div class="flex items-center gap-2">
            <h1
              class="font-display text-2xl font-bold tracking-tight"
              style="color: var(--foreground)"
            >
              执行详情
            </h1>
            <el-tag
              :type="statusMeta?.tagType"
              effect="light"
            >
              {{ statusMeta?.label }}
            </el-tag>
          </div>
          <p
            class="mt-1 text-xs"
            style="color: var(--foreground); opacity: 0.55"
          >
            工作流：{{ wf?.name ?? wfId }} · 执行 ID：{{ exec.id }}
          </p>
        </div>
        <el-button
          :icon="Refresh"
          @click="refetch()"
        >
          刷新
        </el-button>
      </div>

      <!-- 时间 / 耗时 -->
      <el-card class="mb-4">
        <div class="grid grid-cols-2 gap-4 md:grid-cols-4">
          <div>
            <div
              class="text-[11px] tracking-wider"
              style="color: var(--foreground); opacity: 0.5"
            >
              状态
            </div>
            <div
              class="mt-1 text-sm font-medium"
              style="color: var(--foreground)"
            >
              {{ statusMeta?.label }}
            </div>
          </div>
          <div>
            <div
              class="text-[11px] tracking-wider"
              style="color: var(--foreground); opacity: 0.5"
            >
              耗时
            </div>
            <div
              class="mt-1 text-sm font-medium"
              style="color: var(--foreground)"
            >
              {{ formatDuration(exec.durationMs) }}
            </div>
          </div>
          <div>
            <div
              class="text-[11px] tracking-wider"
              style="color: var(--foreground); opacity: 0.5"
            >
              开始
            </div>
            <div
              class="mt-1 text-sm font-medium"
              style="color: var(--foreground)"
            >
              {{ formatDate(exec.startedAt) || '—' }}
            </div>
          </div>
          <div>
            <div
              class="text-[11px] tracking-wider"
              style="color: var(--foreground); opacity: 0.5"
            >
              完成
            </div>
            <div
              class="mt-1 text-sm font-medium"
              style="color: var(--foreground)"
            >
              {{ formatDate(exec.completedAt) || '—' }}
            </div>
          </div>
        </div>
      </el-card>

      <!-- 错误 -->
      <el-alert
        v-if="exec.errorMessage"
        type="error"
        :title="exec.errorMessage"
        :closable="false"
        class="mb-4"
      />

      <div class="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <!-- 输入 -->
        <el-card>
          <h2
            class="mb-3 text-sm font-semibold"
            style="color: var(--foreground)"
          >
            输入
          </h2>
          <pre
            class="max-h-[260px] overflow-auto rounded-lg p-3 text-xs leading-5"
            style="background: var(--surface-secondary); color: var(--foreground); border: 1px solid var(--border)"
          ><code>{{ inputText }}</code></pre>
        </el-card>
        <!-- 输出 -->
        <el-card>
          <h2
            class="mb-3 text-sm font-semibold"
            style="color: var(--foreground)"
          >
            输出
          </h2>
          <pre
            v-if="outputText"
            class="max-h-[260px] overflow-auto rounded-lg p-3 text-xs leading-5"
            style="background: var(--surface-secondary); color: var(--foreground); border: 1px solid var(--border)"
          ><code>{{ outputText }}</code></pre>
          <el-empty
            v-else
            description="尚无输出"
            :image-size="60"
          />
        </el-card>
      </div>

      <!-- 节点步骤 -->
      <el-card class="mt-4">
        <div class="mb-3 flex items-center justify-between">
          <h2
            class="text-sm font-semibold"
            style="color: var(--foreground)"
          >
            节点步骤
          </h2>
          <span
            class="text-xs"
            style="color: var(--foreground); opacity: 0.5"
          >
            {{ exec.nodeSteps?.length ?? 0 }} 步
          </span>
        </div>
        <el-empty
          v-if="!exec.nodeSteps?.length"
          description="尚无节点步骤"
        />
        <ol
          v-else
          class="flex flex-col gap-3"
        >
          <li
            v-for="(step, idx) in exec.nodeSteps"
            :key="idx"
            class="rounded-lg p-3"
            style="background: var(--surface-secondary); border: 1px solid var(--border)"
          >
            <div class="flex items-center justify-between gap-3">
              <div class="flex items-center gap-2 min-w-0">
                <span
                  class="text-xs opacity-60 shrink-0"
                  style="color: var(--foreground)"
                >
                  #{{ idx + 1 }}
                </span>
                <el-tag
                  size="small"
                  effect="dark"
                >
                  {{ step.nodeType ? (WORKFLOW_NODE_TYPE_LABELS[step.nodeType] ?? step.nodeType) : 'node' }}
                </el-tag>
                <span
                  class="truncate text-sm font-medium"
                  style="color: var(--foreground)"
                >
                  {{ step.nodeLabel || step.nodeId }}
                </span>
                <el-tag
                  :type="stepTagType(step.status)"
                  size="small"
                  effect="light"
                >
                  {{ step.status }}
                </el-tag>
              </div>
              <div
                class="shrink-0 text-xs"
                style="color: var(--foreground); opacity: 0.55"
              >
                {{ formatDuration(step.durationMs) }}
              </div>
            </div>
            <div
              v-if="step.error"
              class="mt-2 text-xs"
              style="color: var(--el-color-error)"
            >
              {{ step.error }}
            </div>
            <div
              v-if="step.input || step.output"
              class="mt-2 grid grid-cols-1 gap-2 md:grid-cols-2"
            >
              <div>
                <div
                  class="mb-1 text-[10px] tracking-wider"
                  style="color: var(--foreground); opacity: 0.45"
                >
                  INPUT
                </div>
                <pre
                  class="max-h-[160px] overflow-auto rounded-md p-2 text-[11px] leading-4"
                  style="background: var(--el-bg-color-page); color: var(--foreground)"
                ><code>{{ JSON.stringify(step.input, null, 2) }}</code></pre>
              </div>
              <div>
                <div
                  class="mb-1 text-[10px] tracking-wider"
                  style="color: var(--foreground); opacity: 0.45"
                >
                  OUTPUT
                </div>
                <pre
                  class="max-h-[160px] overflow-auto rounded-md p-2 text-[11px] leading-4"
                  style="background: var(--el-bg-color-page); color: var(--foreground)"
                ><code>{{ JSON.stringify(step.output, null, 2) }}</code></pre>
              </div>
            </div>
          </li>
        </ol>
      </el-card>
    </template>

    <el-result
      v-else
      icon="error"
      title="执行记录不存在"
    >
      <template #extra>
        <el-button
          type="primary"
          @click="router.push(`/workflows/${wfId}`)"
        >
          返回详情
        </el-button>
      </template>
    </el-result>
  </div>
</template>
