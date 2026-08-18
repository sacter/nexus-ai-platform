<script setup lang="ts">
import { computed } from 'vue'
import type { MessagePhase } from '../types/chat'

const props = defineProps<{ phase: MessagePhase; message?: string }>()

const labelMap: Record<string, string> = {
  retrieving: '正在检索知识库…',
  reranking: '正在精排结果…',
  generating: '正在生成回答…',
  pendingCreate: '正在创建会话…',
}

const visible = computed(() => ['retrieving', 'reranking', 'generating', 'pendingCreate'].includes(props.phase))
const label = computed(() => props.message || labelMap[props.phase] || '')
</script>

<template>
  <div
    v-if="visible"
    class="rise-in inline-flex items-center gap-2 self-start rounded-full px-3 py-1.5 text-xs"
    :style="{ backgroundColor: 'var(--accent-soft)', color: 'var(--accent)' }"
  >
    <span class="inline-block h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" />
    <span>{{ label }}</span>
  </div>
</template>
