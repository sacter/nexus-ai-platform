<script setup lang="ts">
import { computed, type Component } from 'vue'
import { Delete, Edit, ChatDotRound, DataLine, Sort, Cpu, Odometer, View, Tools, Connection, Key, Link } from '@element-plus/icons-vue'
import { MODEL_TYPES, PROVIDERS } from '@/modules/models/types/model'
import type { Model, ModelChatConfig, ModelEmbeddingConfig, ModelRerankConfig, ModelType } from '@/modules/models/types/model'

const props = defineProps<{ model: Model; toggling?: boolean }>()
const emit = defineEmits<{
  edit: [model: Model]
  delete: [model: Model]
  toggle: [model: Model, val: boolean]
}>()

const providerMeta = computed(() => PROVIDERS.find((p) => p.value === props.model.provider))
const typeMeta = computed(() => MODEL_TYPES.find((t) => t.value === props.model.type))

const TYPE_ICONS: Record<ModelType, Component> = {
  chat: ChatDotRound,
  embedding: DataLine,
  rerank: Sort,
}

// 类型色点：chat 跟随主题 accent，embedding/rerank 用语义色，保证多主题协调
const TYPE_STYLE: Record<ModelType, { color: string; bg: string; border: string }> = {
  chat: {
    color: 'var(--accent)',
    bg: 'var(--accent-soft)',
    border: 'color-mix(in oklch, var(--accent) 28%, transparent)',
  },
  embedding: {
    color: 'var(--el-color-success)',
    bg: 'color-mix(in oklch, var(--el-color-success) 10%, transparent)',
    border: 'color-mix(in oklch, var(--el-color-success) 28%, transparent)',
  },
  rerank: {
    color: 'var(--el-color-warning)',
    bg: 'color-mix(in oklch, var(--el-color-warning) 10%, transparent)',
    border: 'color-mix(in oklch, var(--el-color-warning) 28%, transparent)',
  },
}

// 能力徽章：按 type 从 config 提取可展示项
const badges = computed<{ icon: Component; text: string; title: string }[]>(() => {
  const m = props.model
  const out: { icon: Component; text: string; title: string }[] = []
  if (m.type === 'chat') {
    const c = m.config as ModelChatConfig
    if (c.maxTokens) out.push({ icon: Cpu, text: `maxTokens ${c.maxTokens}`, title: '单次最大 Token 数' })
    if (typeof c.temperature === 'number') out.push({ icon: Odometer, text: c.temperature.toFixed(1), title: '采样温度' })
    if (c.supportsVision) out.push({ icon: View, text: 'Vision', title: '支持视觉输入' })
    if (c.supportsTools) out.push({ icon: Tools, text: 'Tools', title: '支持工具调用' })
  } else if (m.type === 'embedding') {
    const c = m.config as ModelEmbeddingConfig
    if (c.dimension) out.push({ icon: DataLine, text: `${c.dimension}d`, title: '向量维度' })
    if (c.maxBatchSize) out.push({ icon: Connection, text: `batch ${c.maxBatchSize}`, title: '最大批量' })
  } else {
    const c = m.config as ModelRerankConfig
    if (c.maxBatchSize) out.push({ icon: Connection, text: `batch ${c.maxBatchSize}`, title: '最大批量' })
  }
  return out
})

const credentialLabel = computed(() => {
  if (!props.model.apiKeyId) return '环境变量默认'
  return props.model.apiKeyName ?? '已关联凭证'
})
</script>

<template>
  <el-card
    shadow="hover"
    class="group"
    :class="{ 'is-disabled-model': !model.isActive }"
  >
    <!-- Provider 品牌行 -->
    <div class="flex items-center justify-between gap-2">
      <div class="flex min-w-0 items-center gap-2">
        <span
          class="h-2 w-2 shrink-0 rounded-full"
          :style="{
            background: providerMeta?.brand ?? 'var(--accent)',
            boxShadow: `0 0 0 3px color-mix(in oklch, ${providerMeta?.brand ?? 'var(--accent)'} 18%, transparent)`,
          }"
        />
        <span
          class="truncate text-xs font-semibold uppercase tracking-wide"
          style="color: var(--foreground); opacity: 0.65"
        >{{ providerMeta?.label ?? model.provider }}</span>
        <span
          class="flex shrink-0 items-center gap-1 rounded-md border px-1.5 py-0.5 text-[11px] font-medium"
          :style="TYPE_STYLE[model.type]"
        >
          <el-icon :size="12">
            <component :is="TYPE_ICONS[model.type]" />
          </el-icon>
          {{ typeMeta?.label ?? model.type }}
        </span>
        <el-tag
          v-if="!model.isActive"
          size="small"
          type="danger"
          effect="plain"
        >
          已停用
        </el-tag>
      </div>
      <el-switch
        :model-value="model.isActive"
        size="small"
        :loading="toggling"
        aria-label="启用状态"
        @change="(v: boolean | string | number) => emit('toggle', model, Boolean(v))"
      />
    </div>

    <!-- 模型名 -->
    <h3
      class="mt-3 truncate font-display text-lg font-bold tracking-tight"
      style="color: var(--foreground)"
      :title="model.displayName"
    >
      {{ model.displayName }}
    </h3>
    <code
      class="block truncate font-mono text-xs"
      style="color: var(--foreground); opacity: 0.55"
      :title="model.modelName"
    >{{ model.modelName }}</code>
    <p
      v-if="model.description"
      class="mt-2 text-xs leading-relaxed"
      style="
        display: -webkit-box;
        -webkit-box-orient: vertical;
        -webkit-line-clamp: 2;
        overflow: hidden;
        text-overflow: ellipsis;
        color: var(--foreground);
        opacity: 0.5;
      "
    >
      {{ model.description }}
    </p>

    <!-- 能力徽章 -->
    <div
      v-if="badges.length"
      class="mt-3 flex flex-wrap gap-1.5 mb-3"
    >
      <el-tooltip
        v-for="b in badges"
        :key="b.text"
        :content="b.title"
        placement="top"
      >
        <span
          class="badge inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[11px]"
          style="border-color: var(--border); background: var(--surface-secondary); color: var(--foreground)"
        >
          <el-icon :size="12">
            <component :is="b.icon" />
          </el-icon>
          <span class="num">{{ b.text }}</span>
        </span>
      </el-tooltip>
    </div>

    <!-- 凭证 + 操作：mt-auto 贴卡片底部（等高网格下永远置底） -->
    <div
      class="mt-auto flex items-center justify-between gap-2 border-t pt-2"
      style="border-color: var(--border)"
    >
      <span
        class="flex min-w-0 items-center gap-1.5 text-xs"
        :style="{
          color: 'var(--foreground)',
          opacity: model.apiKeyId ? 0.6 : 0.4,
        }"
      >
        <el-icon :size="13">
          <component :is="model.apiKeyId ? Key : Link" />
        </el-icon>
        <span class="truncate">{{ credentialLabel }}</span>
      </span>
      <div class="ops-group flex shrink-0 items-center">
        <el-tooltip content="编辑">
          <el-button
            text
            aria-label="编辑"
            @click="emit('edit', model)"
          >
            <el-icon :size="16">
              <Edit />
            </el-icon>
          </el-button>
        </el-tooltip>
        <el-popconfirm
          :title="`确定删除模型「${model.displayName}」？该操作不可恢复`"
          width="260"
          confirm-button-text="删除"
          cancel-button-text="取消"
          confirm-button-type="danger"
          @confirm="emit('delete', model)"
        >
          <template #reference>
            <el-button
              type="danger"
              text
              aria-label="删除"
            >
              <el-icon :size="16">
                <Delete />
              </el-icon>
            </el-button>
          </template>
        </el-popconfirm>
      </div>
    </div>
  </el-card>
</template>

<style scoped>
/* 卡片 body 纵向 flex：内容不足时“凭证 + 操作”仍贴底 */
:deep(.el-card__body) {
  display: flex;
  flex-direction: column;
  height: 100%;
}

/* 操作按钮紧凑排列（覆盖 el-button 相邻 margin-left） */
.ops-group :deep(.el-button + .el-button) {
  margin-left: 4px;
}

/* 停用模型整卡视觉弱化 */
.is-disabled-model :deep(.el-card__body) {
  opacity: 0.72;
}
</style>
