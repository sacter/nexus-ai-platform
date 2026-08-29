<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { ArrowLeft, Delete, Edit, Refresh, VideoPlay } from '@element-plus/icons-vue'
import {
  useDeleteWorkflow,
  useRunWorkflow,
  useWorkflow,
  useWorkflowExecutions,
} from '@/modules/workflow/composables/useWorkflow'
import WorkflowGraphPreview from '@/modules/workflow/components/WorkflowGraphPreview.vue'
import ExecutionList from '@/modules/workflow/components/ExecutionList.vue'
import {
  WORKFLOW_TYPE_LABELS,
  WORKFLOW_TYPE_META,
} from '@/modules/workflow/types/workflow'
import type { WorkflowExecution } from '@/modules/workflow/types/workflow'
import { formatDate } from '@/utils/format'

const route = useRoute()
const router = useRouter()
const wfId = String(route.params.id ?? '')

const { data: wf, isLoading, refetch } = useWorkflow(wfId)
const {
  data: executions,
  isLoading: execLoading,
  refetch: refetchExecs,
} = useWorkflowExecutions(wfId)

const deleteMutation = useDeleteWorkflow()
const runMutation = useRunWorkflow()

const meta = computed(() =>
  wf.value ? WORKFLOW_TYPE_META[wf.value.type] : null,
)
const typeLabel = computed(() =>
  wf.value ? (WORKFLOW_TYPE_LABELS[wf.value.type] ?? wf.value.type) : '',
)
const nodes = computed(() => wf.value?.nodes ?? [])
const edges = computed(() => wf.value?.edges ?? [])
const configText = computed(() => JSON.stringify(wf.value?.config ?? {}, null, 2))

const runningNow = ref(false)
async function handleRun() {
  if (!wf.value) return
  runningNow.value = true
  try {
    const exec = await runMutation.mutateAsync({ id: wfId, data: {} })
    ElMessage.success(`「${wf.value.name}」开始执行`)
    await refetchExecs()
    router.push(`/workflows/${wfId}/executions/${exec.id}`)
  } catch (e) {
    ElMessage.error((e as Error).message || '执行失败')
  } finally {
    runningNow.value = false
  }
}

function handleEdit() {
  router.push(`/workflows/${wfId}/edit`)
}

async function handleDelete() {
  try {
    await ElMessageBox.confirm(
      `删除后不可恢复，使用此 Workflow 的 AI 应用将无法运行。确定删除「${wf.value?.name}」？`,
      '删除工作流',
      { confirmButtonText: '删除', cancelButtonText: '取消', type: 'warning' },
    )
  } catch {
    return
  }
  deleteMutation.mutate(wfId, {
    onSuccess: () => {
      ElMessage.success('工作流已删除')
      router.push('/workflows')
    },
    onError: (e) => ElMessage.error((e as Error).message || '删除失败'),
  })
}

function handleViewExecution(exec: WorkflowExecution) {
  router.push(`/workflows/${wfId}/executions/${exec.id}`)
}

/** 手动刷新（运行中状态下用户可能多次刷新） */
function handleRefresh() {
  refetch()
  refetchExecs()
}
</script>

<template>
  <div>
    <el-skeleton
      v-if="isLoading"
      animated
      :rows="10"
    />

    <template v-else-if="wf">
      <div class="mb-4">
        <el-button
          text
          :icon="ArrowLeft"
          @click="router.push('/workflows')"
        >
          返回列表
        </el-button>
      </div>

      <!-- 页头：身份 + 操作 -->
      <div class="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div class="flex items-start gap-3">
          <div
            class="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-2xl"
            :style="{ background: `color-mix(in oklch, ${meta?.color ?? 'var(--accent)'} 15%, transparent)` }"
          >
            {{ meta?.icon ?? '⚙️' }}
          </div>
          <div>
            <div class="flex items-center gap-2">
              <h1
                class="font-display text-2xl font-bold tracking-tight"
                style="color: var(--foreground)"
              >
                {{ wf.name }}
              </h1>
              <el-tag
                :style="{ borderColor: meta?.color, color: meta?.color }"
                effect="plain"
              >
                {{ typeLabel }}
              </el-tag>
              <el-tag
                v-if="!wf.isActive"
                type="info"
                effect="plain"
              >
                已停用
              </el-tag>
              <span
                class="text-xs"
                style="color: var(--foreground); opacity: 0.5"
              >
                v{{ wf.version }}
              </span>
            </div>
            <p
              class="mt-1 text-xs"
              style="color: var(--foreground); opacity: 0.55"
            >
              {{ wf.description || meta?.hint || '暂无描述' }}
            </p>
          </div>
        </div>
        <div class="flex flex-wrap items-center gap-2">
          <el-button
            type="primary"
            :icon="VideoPlay"
            :loading="runningNow"
            :disabled="!wf.isActive"
            @click="handleRun"
          >
            立即运行
          </el-button>
          <el-button
            :icon="Refresh"
            @click="handleRefresh"
          >
            刷新
          </el-button>
          <el-button
            :icon="Edit"
            @click="handleEdit"
          >
            编辑
          </el-button>
          <el-button
            type="danger"
            plain
            :icon="Delete"
            @click="handleDelete"
          >
            删除
          </el-button>
        </div>
      </div>

      <div class="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <!-- 图结构预览（左侧 2/3） -->
        <el-card class="xl:col-span-2">
          <div class="mb-3 flex items-center justify-between">
            <h2
              class="text-sm font-semibold"
              style="color: var(--foreground)"
            >
              流程图
            </h2>
            <span
              class="text-xs"
              style="color: var(--foreground); opacity: 0.5"
            >
              节点 {{ nodes.length }} · 边 {{ edges.length }} · 拖拽全面改造（V3 提供）
            </span>
          </div>
          <WorkflowGraphPreview
            :nodes="nodes"
            :edges="edges"
          />
        </el-card>

        <!-- 配置 JSON（右侧 1/3） -->
        <el-card>
          <h2
            class="mb-3 text-sm font-semibold"
            style="color: var(--foreground)"
          >
            顶层配置 (JSON)
          </h2>
          <pre
            class="rounded-lg overflow-auto text-xs leading-5 max-h-[320px] p-3"
            style="background: var(--surface-secondary); color: var(--foreground); border: 1px solid var(--border)"
          ><code>{{ configText }}</code></pre>
          <p
            class="mt-3 text-[11px]"
            style="color: var(--foreground); opacity: 0.5"
          >
            type = <code>{{ wf.type }}</code>；节点级配置请参考各 node.config
          </p>
        </el-card>
      </div>

      <!-- 执行历史 -->
      <el-card class="mt-4">
        <div class="mb-3 flex items-center justify-between">
          <h2
            class="text-sm font-semibold"
            style="color: var(--foreground)"
          >
            执行历史
          </h2>
          <span
            class="text-xs"
            style="color: var(--foreground); opacity: 0.5"
          >
            {{ executions?.length ?? 0 }} 次执行
          </span>
        </div>
        <ExecutionList
          :executions="executions"
          :loading="execLoading"
          @view-detail="handleViewExecution"
        />
      </el-card>

      <p
        class="mt-4 text-[11px]"
        style="color: var(--foreground); opacity: 0.45"
      >
        创建于 {{ formatDate(wf.createdAt) }} · 更新于 {{ formatDate(wf.updatedAt) }}
      </p>
    </template>

    <el-result
      v-else
      icon="error"
      title="Workflow 不存在"
    >
      <template #extra>
        <el-button
          type="primary"
          @click="router.push('/workflows')"
        >
          返回列表
        </el-button>
      </template>
    </el-result>
  </div>
</template>
