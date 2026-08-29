<script setup lang="ts">
import { computed } from 'vue'
import { ChatLineSquare } from '@element-plus/icons-vue'
import { DEFAULT_SUGGESTIONS, type ChatSuggestion } from './suggestions'

const props = defineProps<{
  title?: string
  subtitle?: string
  suggestions?: ChatSuggestion[]
}>()
const emit = defineEmits<{ (e: 'suggest', s: ChatSuggestion): void }>()

const list = computed(() => props.suggestions?.length ? props.suggestions : DEFAULT_SUGGESTIONS)
</script>

<template>
  <div class="mx-auto flex min-h-[320px] w-full max-w-[760px] flex-col items-center justify-center gap-3 px-6 text-center">
    <div
      class="rise-in flex h-11 w-11 items-center justify-center rounded-xl"
      style="background: var(--brand-gradient); box-shadow: 0 8px 20px -8px color-mix(in oklch, var(--accent) 55%, transparent)"
    >
      <el-icon :size="20" color="var(--accent-foreground)"><ChatLineSquare /></el-icon>
    </div>
    <h2
      class="rise-in font-display text-xl font-bold tracking-tight"
      style="color: var(--foreground); animation-delay: 60ms"
    >
      {{ title ?? '开始对话' }}
    </h2>
    <p
      class="rise-in text-sm"
      style="color: var(--foreground); opacity: 0.55; animation-delay: 120ms"
    >
      {{ subtitle ?? '基于企业知识库的智能问答，支持引用溯源' }}
    </p>
    <div class="mt-2 grid w-full max-w-[520px] grid-cols-1 gap-2 sm:grid-cols-2">
      <button
        v-for="(s, i) in list"
        :key="s.text"
        type="button"
        class="suggest-card rise-in flex flex-col gap-1 rounded-lg border px-3.5 py-3 text-left"
        :style="{
          borderColor: 'var(--border)',
          backgroundColor: 'var(--surface)',
          animationDelay: `${180 + i * 60}ms`,
        }"
        @click="emit('suggest', s)"
      >
        <span class="flex items-center gap-2 text-sm font-medium" style="color: var(--foreground)">
          <span
            class="flex h-6 w-6 items-center justify-center rounded-md"
            style="background: var(--accent-soft); color: var(--accent)"
          >
            <el-icon :size="14"><component :is="s.icon" /></el-icon>
          </span>
          {{ s.title }}
        </span>
        <span class="text-xs" style="color: var(--foreground); opacity: 0.55">{{ s.text }}</span>
      </button>
    </div>
  </div>
</template>

<style scoped>
.suggest-card {
  transition:
    transform var(--dur-base) var(--ease-out),
    box-shadow var(--dur-base) var(--ease-out),
    border-color var(--dur-base) ease;
}
.suggest-card:hover {
  transform: translateY(-2px);
  border-color: color-mix(in oklch, var(--accent) 32%, var(--border));
  box-shadow: 0 12px 16px -12px var(--accent-glow);
}
</style>
