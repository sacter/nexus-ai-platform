<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Plus, Search, Share } from '@element-plus/icons-vue'
import {
  useDeleteWorkflow,
  useRunWorkflow,
  useWorkflows,
} from '@/modules/workflow/composables/useWorkflow'
import WorkflowCard from '@/modules/workflow/components/WorkflowCard.vue'
import { WORKFLOW_TYPE_LABELS, WORKFLOW_TYPES } from '@/modules/workflow/types/workflow'
import type { WorkflowType } from '@/modules/workflow/types/workflow'

const router = useRouter()
const { data: workflows, isLoading } = useWorkflows()
const deleteMutation = useDeleteWorkflow()
const runMutation = useRunWorkflow()

// 防御：响应异常分支可能返回非数组
const list = computed(() => (Array.isArray(workflows.value) ? workflows.value : []))

// 筛选
const keyword = ref('')
const typeFilter = ref<'all' | WorkflowType>('all')

const filtered = computed(() => {
  const kw = keyword.value.trim().toLowerCase()
  return list.value.filter((wf) => {
    if (typeFilter.value !== 'all' && wf.type !== typeFilter.value) return false
    if (!kw) return true
    return (
      wf.name.toLowerCase().includes(kw) ||
      (wf.description ?? '').toLowerCase().includes(kw)
    )
  })
})

function handleView(id: string) {
  router.push(`/workflows/${id}`)
}
function handleEdit(id: string) {
  router.push(`/workflows/${id}/edit`)
}
async function handleDelete(id: string) {
  const wf = list.value.find((w) => w.id === id)
  try {
    await ElMessageBox.confirm(
      `删除后不可恢复，AI 应用已绑定此工作流的调用将无法运行。确定删除「${wf?.name}」？`,
      '删除工作流',
      { confirmButtonText: '删除', cancelButtonText: '取消', type: 'warning' },
    )
  } catch {
    return
  }
  deleteMutation.mutate(id, {
    onSuccess: () => ElMessage.success('工作流已删除'),
    onError: (e) => ElMessage.error((e as Error).message || '删除失败'),
  })
}
async function handleRun(id: string) {
  const wf = list.value.find((w) => w.id === id)
  try {
    const exec = await runMutation.mutateAsync({ id, data: {} })
    ElMessage.success(`「${wf?.name}」已开始执行`)
    router.push(`/workflows/${id}/executions/${exec.id}`)
  } catch (e) {
    ElMessage.error((e as Error).message || '执行失败')
  }
}
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
            <Share />
          </el-icon>
        </div>
        <div>
          <h1
            class="font-display text-2xl font-bold tracking-tight"
            style="color: var(--foreground)"
          >
            Workflow
          </h1>
          <p
            class="mt-0.5 text-xs"
            style="color: var(--foreground); opacity: 0.55"
          >
            可视化编排多步骤自动化流程
          </p>
        </div>
      </div>
      <el-button
        type="primary"
        :icon="Plus"
        @click="router.push('/workflows/new')"
      >
        创建工作流
      </el-button>
    </div>

    <div
      v-if="list.length > 0"
      class="mb-4 flex flex-wrap items-center gap-3"
    >
      <el-input
        v-model="keyword"
        placeholder="搜索名称或描述"
        :prefix-icon="Search"
        clearable
        class="!w-64"
      />
      <el-radio-group
        v-model="typeFilter"
        size="small"
      >
        <el-radio-button value="all">
          全部
        </el-radio-button>
        <el-radio-button
          v-for="t in WORKFLOW_TYPES"
          :key="t"
          :value="t"
        >
          {{ WORKFLOW_TYPE_LABELS[t] }}
        </el-radio-button>
      </el-radio-group>
      <span
        class="ml-auto text-xs"
        style="color: var(--foreground); opacity: 0.5"
      >
        {{ filtered.length }} / {{ list.length }} 个工作流
      </span>
    </div>

    <div
      v-if="isLoading"
      class="grid grid-cols-1 gap-[11.2px] md:grid-cols-2 xl:grid-cols-3"
    >
      <el-skeleton
        v-for="i in 6"
        :key="i"
        animated
      >
        <template #template>
          <el-skeleton-item
            variant="rect"
            style="height: 150px; border-radius: 12px"
          />
        </template>
      </el-skeleton>
    </div>

    <template v-else-if="list.length > 0">
      <div
        v-if="filtered.length > 0"
        class="grid grid-cols-1 gap-[11.2px] md:grid-cols-2 xl:grid-cols-3"
      >
        <WorkflowCard
          v-for="wf in filtered"
          :key="wf.id"
          :workflow="wf"
          @view="handleView"
          @edit="handleEdit"
          @delete="handleDelete"
          @run="handleRun"
        />
      </div>
      <el-empty
        v-else
        description="没有匹配的工作流"
      />
    </template>

    <el-empty
      v-else
      description="还没有工作流，从装配第一个开始"
    >
      <el-button
        type="primary"
        :icon="Plus"
        @click="router.push('/workflows/new')"
      >
        创建工作流
      </el-button>
    </el-empty>
  </div>
</template>
