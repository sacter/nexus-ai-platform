<script setup lang="ts">
import { computed, ref } from 'vue'
import { Plus, Search, Cpu, ChatDotRound, DataLine, Sort } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import { useModels, useDeleteModel, useUpdateModel } from '@/modules/models/composables/useModels'
import { MODEL_TYPES, PROVIDERS } from '@/modules/models/types/model'
import type { Model, ModelType } from '@/modules/models/types/model'
import ModelCard from '@/modules/models/components/ModelCard.vue'
import ModelForm from '@/modules/models/components/ModelForm.vue'

const { data: models, isLoading } = useModels()
const deleteMutation = useDeleteModel()
const updateMutation = useUpdateModel()

// 防御：非数组兜底（后端异常返回时不崩溃）
const modelList = computed<Model[]>(() => (Array.isArray(models.value) ? models.value : []))

// ---- 筛选：类型统计块 / Provider / 搜索 ----
const activeType = ref<ModelType | 'all'>('all')
const activeProvider = ref<string>('all')
const search = ref('')

const TYPE_ICONS: Record<ModelType, typeof ChatDotRound> = {
  chat: ChatDotRound,
  embedding: DataLine,
  rerank: Sort,
}

const STATS: { key: ModelType | 'all'; label: string; icon: typeof Cpu }[] = [
  { key: 'all', label: '全部模型', icon: Cpu },
  { key: 'chat', label: 'Chat', icon: ChatDotRound },
  { key: 'embedding', label: 'Embedding', icon: DataLine },
  { key: 'rerank', label: 'Rerank', icon: Sort },
]

const counts = computed(() => ({
  all: modelList.value.length,
  chat: modelList.value.filter((m) => m.type === 'chat').length,
  embedding: modelList.value.filter((m) => m.type === 'embedding').length,
  rerank: modelList.value.filter((m) => m.type === 'rerank').length,
}))

// 仅展示当前已注册的 Provider，避免空选项
const providerOptions = computed(() => {
  const used = new Set(modelList.value.map((m) => m.provider))
  return PROVIDERS.filter((p) => used.has(p.value))
})

const filtered = computed(() => {
  const kw = search.value.trim().toLowerCase()
  return modelList.value.filter((m) => {
    if (activeType.value !== 'all' && m.type !== activeType.value) return false
    if (activeProvider.value !== 'all' && m.provider !== activeProvider.value) return false
    if (!kw) return true
    const providerLabel = PROVIDERS.find((p) => p.value === m.provider)?.label ?? m.provider
    return (
      m.displayName.toLowerCase().includes(kw) ||
      m.modelName.toLowerCase().includes(kw) ||
      providerLabel.toLowerCase().includes(kw)
    )
  })
})

// 按 type 分组（对应注册中心分类：Chat / Embedding / Rerank）
const grouped = computed(() => {
  const g: Record<ModelType, Model[]> = { chat: [], embedding: [], rerank: [] }
  for (const m of filtered.value) g[m.type].push(m)
  return g
})

const hasFilter = computed(
  () => activeType.value !== 'all' || activeProvider.value !== 'all' || search.value.trim() !== '',
)

function clearFilter() {
  activeType.value = 'all'
  activeProvider.value = 'all'
  search.value = ''
}

// ---- 注册 / 编辑弹窗 ----
const formVisible = ref(false)
const editingModel = ref<Model | null>(null)

function openCreate() {
  editingModel.value = null
  formVisible.value = true
}

function openEdit(m: Model) {
  editingModel.value = m
  formVisible.value = true
}

// ---- 行内启停 ----
const togglingId = ref('')

async function handleToggle(m: Model, val: boolean) {
  togglingId.value = m.id
  try {
    await updateMutation.mutateAsync({
      id: m.id,
      data: {
        provider: m.provider,
        modelName: m.modelName,
        type: m.type,
        displayName: m.displayName,
        description: m.description ?? null,
        apiKeyId: m.apiKeyId ?? null,
        config: m.config,
        isActive: val,
      },
    })
    ElMessage.success(val ? '模型已启用' : '模型已停用')
  } catch (e) {
    ElMessage.error((e as Error).message || '操作失败')
  } finally {
    togglingId.value = ''
  }
}

// ---- 删除（卡片内 popconfirm 确认后触发） ----
function handleDelete(m: Model) {
  deleteMutation.mutate(m.id, {
    onSuccess: () => ElMessage.success('模型已删除'),
    onError: (e) => ElMessage.error((e as Error).message || '删除失败'),
  })
}
</script>

<template>
  <div>
    <!-- Hero -->
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
            模型
          </h1>
          <p
            class="mt-0.5 text-xs"
            style="color: var(--foreground); opacity: 0.55"
          >
            模型注册中心 — 统一管理平台所有可用模型；凭证与 API Key 层解耦，按类型分类
          </p>
        </div>
      </div>
      <el-button
        type="primary"
        :icon="Plus"
        @click="openCreate"
      >
        注册模型
      </el-button>
    </div>

    <!-- 统计筛选条：数量统计即类型筛选 -->
    <div
      v-if="!isLoading && modelList.length"
      class="mb-4 flex flex-wrap items-center gap-2"
    >
      <button
        v-for="s in STATS"
        :key="s.key"
        type="button"
        class="stat-block"
        :class="{ active: activeType === s.key }"
        @click="activeType = s.key"
      >
        <el-icon :size="15">
          <component :is="s.icon" />
        </el-icon>
        <span class="num stat-num">{{ counts[s.key] }}</span>
        <span class="stat-label">{{ s.label }}</span>
      </button>
    </div>

    <!-- 工具栏：搜索 + Provider 筛选 -->
    <div
      v-if="!isLoading && modelList.length"
      class="mb-4 flex items-center gap-2"
    >
      <el-input
        v-model="search"
        placeholder="搜索模型名称 / Provider"
        :prefix-icon="Search"
        clearable
        style="width: 260px"
      />
      <el-select
        :model-value="activeProvider"
        placeholder="全部 Provider"
        clearable
        style="width: 180px"
        @update:model-value="(v: string) => (activeProvider = v ?? 'all')"
      >
        <el-option
          v-for="p in providerOptions"
          :key="p.value"
          :label="p.label"
          :value="p.value"
        >
          <span class="flex items-center gap-2">
            <span
              class="h-2 w-2 rounded-full"
              :style="{ background: p.brand }"
            />
            {{ p.label }}
          </span>
        </el-option>
      </el-select>
    </div>

    <!-- 加载骨架 -->
    <div
      v-if="isLoading"
      class="grid grid-cols-3 gap-[11.2px]"
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

    <!-- 空状态 -->
    <el-empty
      v-else-if="!modelList.length"
      description="暂无模型"
    >
      <el-button
        type="primary"
        :icon="Plus"
        @click="openCreate"
      >
        注册第一个模型
      </el-button>
    </el-empty>
    <el-empty
      v-else-if="!filtered.length"
      :description="hasFilter ? '没有匹配的模型' : '暂无模型'"
    >
      <el-button
        v-if="hasFilter"
        @click="clearFilter"
      >
        清除筛选
      </el-button>
    </el-empty>

    <!-- 分组渲染：Chat / Embedding / Rerank -->
    <template v-else>
      <div
        v-for="t in MODEL_TYPES"
        :key="t.value"
      >
        <template v-if="grouped[t.value].length">
          <div class="mb-3 flex items-center gap-2.5">
            <span
              class="flex h-6 w-6 items-center justify-center rounded-lg"
              :style="{
                color: 'var(--accent)',
                background: 'var(--accent-soft)',
              }"
            >
              <el-icon :size="14">
                <component :is="TYPE_ICONS[t.value]" />
              </el-icon>
            </span>
            <h2
              class="font-display text-base font-bold tracking-tight"
              style="color: var(--foreground)"
            >
              {{ t.label }} Models
            </h2>
            <span
              class="text-xs"
              style="color: var(--foreground); opacity: 0.45"
            >{{ t.desc }}</span>
            <span
              class="num ml-auto text-xs font-semibold"
              style="color: var(--foreground); opacity: 0.45"
            >{{ grouped[t.value].length }}</span>
            <div
              class="h-px flex-1"
              style="background: var(--grid-line-strong)"
            />
          </div>
          <div class="grid grid-cols-3 gap-[11.2px]">
            <ModelCard
              v-for="m in grouped[t.value]"
              :key="m.id"
              :model="m"
              :toggling="togglingId === m.id"
              @edit="openEdit"
              @toggle="handleToggle"
              @delete="handleDelete"
            />
          </div>
        </template>
      </div>
    </template>

    <!-- 注册 / 编辑弹窗 -->
    <ModelForm
      v-model:visible="formVisible"
      :model="editingModel"
      @saved="formVisible = false"
    />
  </div>
</template>

<style scoped>
/* 统计筛选块 */
.stat-block {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 16px;
  border-radius: 12px;
  border: 1px solid var(--border);
  background: var(--surface);
  cursor: pointer;
  color: var(--foreground);
  opacity: 0.72;
  transition:
    opacity var(--dur-fast) ease,
    border-color var(--dur-fast) ease,
    background-color var(--dur-fast) ease,
    transform var(--dur-fast) var(--ease-out);
}
.stat-block:hover {
  opacity: 1;
  border-color: color-mix(in oklch, var(--accent) 32%, var(--border));
  transform: translateY(-1px);
}
.stat-block.active {
  opacity: 1;
  border-color: color-mix(in oklch, var(--accent) 45%, var(--border));
  background: var(--accent-soft);
}
.stat-block.active .stat-num {
  color: var(--accent);
}
.stat-num {
  font-size: 17px;
  font-weight: 700;
  letter-spacing: -0.02em;
}
.stat-label {
  font-size: 12px;
  opacity: 0.65;
}
</style>
