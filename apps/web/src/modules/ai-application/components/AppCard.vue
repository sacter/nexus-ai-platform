<script setup lang="ts">
import { computed } from 'vue'
import {
  Collection,
  Connection,
  Cpu,
  Delete,
  Edit,
  EditPen,
} from '@element-plus/icons-vue'
import type { AiApplication } from '../types/ai-application'
import { appIconGlyph, statusMeta } from '../types/ai-application'
import { formatDate } from '@/utils/format'

const props = defineProps<{ app: AiApplication }>()

const emit = defineEmits<{
  view: [id: string]
  edit: [id: string]
  delete: [id: string]
}>()

const status = computed(() => statusMeta(props.app.status))

/** 配方条：应用 = 知识库 × 工作流 × 模型 × Prompt（ARCHITECTURE 6.1） */
const recipe = computed(() => [
  { label: '知识库', value: props.app.kbName, icon: Collection },
  { label: '工作流', value: props.app.workflowName, icon: Connection },
  { label: '模型', value: props.app.modelDisplayName, icon: Cpu },
  { label: 'Prompt', value: props.app.promptTemplateName ?? '系统默认', icon: EditPen },
])
</script>

<template>
  <el-card
    shadow="hover"
    class="group cursor-pointer"
    @click="emit('view', app.id)"
  >
    <div class="flex items-start gap-3">
      <div
        class="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-lg"
        style="background: color-mix(in oklch, var(--accent) 12%, transparent)"
      >
        {{ appIconGlyph(app.icon) }}
      </div>
      <div class="min-w-0 flex-1">
        <div class="flex items-center gap-2">
          <h3
            class="truncate text-base font-semibold"
            style="color: var(--foreground)"
          >
            {{ app.name }}
          </h3>
          <el-tag
            :type="status.tagType"
            size="small"
            effect="light"
            class="shrink-0"
          >
            {{ status.label }}
          </el-tag>
        </div>
        <p
          class="mt-1 text-xs line-clamp-2"
          style="color: var(--foreground); opacity: 0.55"
        >
          {{ app.description || '暂无描述' }}
        </p>
      </div>
      <div
        class="ops-group flex shrink-0 gap-1 opacity-0 transition-opacity group-hover:opacity-100"
      >
        <el-tooltip content="编辑">
          <el-button
            text
            size="small"
            aria-label="编辑"
            @click.stop="emit('edit', app.id)"
          >
            <el-icon :size="15">
              <Edit />
            </el-icon>
          </el-button>
        </el-tooltip>
        <el-tooltip content="删除">
          <el-button
            text
            size="small"
            type="danger"
            aria-label="删除"
            @click.stop="emit('delete', app.id)"
          >
            <el-icon :size="15">
              <Delete />
            </el-icon>
          </el-button>
        </el-tooltip>
      </div>
    </div>

    <!-- 配方条：4 格细分隔线，展示装配组成 -->
    <div
      class="mt-3 grid grid-cols-2 gap-px overflow-hidden rounded-lg"
      style="background: var(--border)"
    >
      <div
        v-for="item in recipe"
        :key="item.label"
        class="px-2.5 py-2"
        style="background: var(--surface)"
      >
        <div
          class="flex items-center gap-1 text-[10px] tracking-wider"
          style="color: var(--foreground); opacity: 0.45"
        >
          <el-icon :size="11">
            <component :is="item.icon" />
          </el-icon>
          {{ item.label }}
        </div>
        <div
          class="mt-0.5 truncate text-xs font-medium"
          style="color: var(--foreground)"
          :title="item.value"
        >
          {{ item.value }}
        </div>
      </div>
    </div>

    <div
      class="mt-3 flex items-center justify-between text-[11px]"
      style="color: var(--foreground); opacity: 0.5"
    >
      <span>工具 {{ app.tools.length }} 个</span>
      <span>更新于 {{ formatDate(app.updatedAt) }}</span>
    </div>
  </el-card>
</template>
