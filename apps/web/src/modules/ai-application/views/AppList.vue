<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { Cpu, Plus, Search } from '@element-plus/icons-vue'
import {
  useAiApplications,
  useDeleteAiApplication,
} from '@/modules/ai-application/composables/useAiApplications'
import AppCard from '@/modules/ai-application/components/AppCard.vue'
import { APPLICATION_STATUS } from '@/modules/ai-application/types/ai-application'

const router = useRouter()
const { data: apps, isLoading } = useAiApplications()
const deleteMutation = useDeleteAiApplication()

const keyword = ref('')
const statusFilter = ref('all')

// 防御：响应拦截器异常分支可能返回非数组
const appList = computed(() => (Array.isArray(apps.value) ? apps.value : []))

const filtered = computed(() => {
  const kw = keyword.value.trim().toLowerCase()
  return appList.value.filter((app) => {
    if (statusFilter.value !== 'all' && app.status !== statusFilter.value) {
      return false
    }
    if (!kw) return true
    return (
      app.name.toLowerCase().includes(kw) ||
      (app.description ?? '').toLowerCase().includes(kw)
    )
  })
})

function handleView(id: string) {
  router.push(`/ai-applications/${id}`)
}
function handleEdit(id: string) {
  router.push(`/ai-applications/${id}/edit`)
}
function handleDelete(id: string) {
  deleteMutation.mutate(id, {
    onSuccess: () => ElMessage.success('应用已删除'),
    onError: (e) => ElMessage.error((e as Error).message || '删除失败'),
  })
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
            <Cpu />
          </el-icon>
        </div>
        <div>
          <h1
            class="font-display text-2xl font-bold tracking-tight"
            style="color: var(--foreground)"
          >
            AI 应用
          </h1>
          <p
            class="mt-0.5 text-xs"
            style="color: var(--foreground); opacity: 0.55"
          >
            知识库 × 工作流 × 模型 × Prompt，装配成可发布的对话产品
          </p>
        </div>
      </div>
      <el-button
        type="primary"
        :icon="Plus"
        @click="router.push('/ai-applications/new')"
      >
        创建应用
      </el-button>
    </div>

    <div
      v-if="appList.length > 0"
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
        v-model="statusFilter"
        size="small"
      >
        <el-radio-button value="all">
          全部
        </el-radio-button>
        <el-radio-button
          v-for="s in APPLICATION_STATUS"
          :key="s.value"
          :value="s.value"
        >
          {{ s.label }}
        </el-radio-button>
      </el-radio-group>
      <span
        class="ml-auto text-xs"
        style="color: var(--foreground); opacity: 0.5"
      >
        {{ filtered.length }} / {{ appList.length }} 个应用
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
            style="height: 190px; border-radius: 12px"
          />
        </template>
      </el-skeleton>
    </div>

    <template v-else-if="appList.length > 0">
      <div
        v-if="filtered.length > 0"
        class="grid grid-cols-1 gap-[11.2px] md:grid-cols-2 xl:grid-cols-3"
      >
        <AppCard
          v-for="app in filtered"
          :key="app.id"
          :app="app"
          @view="handleView"
          @edit="handleEdit"
          @delete="handleDelete"
        />
      </div>
      <el-empty
        v-else
        description="没有匹配的应用"
      />
    </template>

    <el-empty
      v-else
      description="还没有 AI 应用，从装配第一个开始"
    >
      <el-button
        type="primary"
        :icon="Plus"
        @click="router.push('/ai-applications/new')"
      >
        创建应用
      </el-button>
    </el-empty>
  </div>
</template>
