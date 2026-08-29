<script setup lang="ts">
import { computed } from 'vue'
import { Delete, Edit, VideoPlay } from '@element-plus/icons-vue'
import type { Workflow } from '../types/workflow'
import { WORKFLOW_TYPE_LABELS, WORKFLOW_TYPE_META } from '../types/workflow'
import { formatDate } from '@/utils/format'

const props = defineProps<{ workflow: Workflow }>()
const emit = defineEmits<{
  view: [id: string]
  edit: [id: string]
  delete: [id: string]
  run: [id: string]
}>()

const meta = computed(() => WORKFLOW_TYPE_META[props.workflow.type])
const typeLabel = computed(() => WORKFLOW_TYPE_LABELS[props.workflow.type] ?? props.workflow.type)
const nodeCount = computed(() => props.workflow.nodes?.length ?? 0)
const edgeCount = computed(() => props.workflow.edges?.length ?? 0)
</script>

<template>
  <el-card
    shadow="hover"
    class="group cursor-pointer"
    @click="emit('view', workflow.id)"
  >
    <div class="flex items-start gap-3">
      <div
        class="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-lg"
        :style="{ background: `color-mix(in oklch, ${meta.color} 15%, transparent)` }"
      >
        {{ meta.icon }}
      </div>
      <div class="min-w-0 flex-1">
        <div class="flex items-center gap-2">
          <h3
            class="truncate text-base font-semibold"
            style="color: var(--foreground)"
          >
            {{ workflow.name }}
          </h3>
          <el-tag
            size="small"
            effect="plain"
            class="shrink-0"
            :style="{ borderColor: meta.color, color: meta.color }"
          >
            {{ typeLabel }}
          </el-tag>
          <el-tag
            v-if="!workflow.isActive"
            size="small"
            type="info"
            effect="plain"
          >
            已停用
          </el-tag>
        </div>
        <p
          class="mt-1 text-xs line-clamp-2"
          style="color: var(--foreground); opacity: 0.55"
        >
          {{ workflow.description || meta.hint }}
        </p>
      </div>
      <div
        class="ops-group flex shrink-0 gap-1 opacity-0 transition-opacity group-hover:opacity-100"
      >
        <el-tooltip content="立即执行">
          <el-button
            text
            size="small"
            type="primary"
            aria-label="执行"
            @click.stop="emit('run', workflow.id)"
          >
            <el-icon :size="15">
              <VideoPlay />
            </el-icon>
          </el-button>
        </el-tooltip>
        <el-tooltip content="编辑">
          <el-button
            text
            size="small"
            aria-label="编辑"
            @click.stop="emit('edit', workflow.id)"
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
            @click.stop="emit('delete', workflow.id)"
          >
            <el-icon :size="15">
              <Delete />
            </el-icon>
          </el-button>
        </el-tooltip>
      </div>
    </div>

    <div
      class="mt-3 flex items-center justify-between text-[11px]"
      style="color: var(--foreground); opacity: 0.5"
    >
      <span v-if="nodeCount || edgeCount">
        节点 {{ nodeCount }} · 边 {{ edgeCount }}
      </span>
      <span v-else>未配置节点</span>
      <span>v{{ workflow.version }} · 更新 {{ formatDate(workflow.updatedAt) }}</span>
    </div>
  </el-card>
</template>
