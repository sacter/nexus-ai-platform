<script setup lang="ts">
import { computed } from 'vue'
import { useClipboard } from '@vueuse/core'
import { renderMarkdown } from '../utils/render-markdown'
import CitationsCard from './CitationsCard.vue'
import type { ChatMessage } from '../types/chat'

const props = defineProps<{ message: ChatMessage }>()
const emit = defineEmits<{
  (e: 'feedback', messageId: string, action: 'like' | 'dislike'): void
}>()

const isUser = computed(() => props.message.role === 'user')
const html = computed(() => (isUser.value ? '' : renderMarkdown(props.message.content)))
const showCursor = computed(() => !!props.message.streaming)
const showTokens = computed(() => props.message.totalTokens != null && props.message.promptTokens != null && props.message.completionTokens != null)
const { copy, copied } = useClipboard()

function onCopy() {
  // copy 返回 Promise；吞掉拒绝避免未处理 rejection（如剪贴板权限被拒）
  copy(props.message.content).catch(() => {})
}
function onFeedback(action: 'like' | 'dislike') {
  if (props.message.id) emit('feedback', props.message.id, action)
}
</script>

<template>
  <div class="flex gap-3 py-2" :class="isUser ? 'flex-row-reverse' : ''">
    <!-- 头像 -->
    <div
      v-if="!isUser"
      class="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs"
      :style="{ backgroundColor: 'var(--accent)', color: '#fff' }"
    >AI</div>

    <div class="max-w-[80%]">
      <div
        class="rounded-2xl px-4 py-2 text-sm leading-relaxed"
        :style="isUser
          ? { backgroundColor: 'var(--accent)', color: '#fff' }
          : { backgroundColor: 'var(--surface)', color: 'var(--foreground)', border: '1px solid var(--border)' }"
      >
        <div v-if="isUser">{{ message.content }}</div>
        <div v-else class="prose-chat" v-html="html" />
        <span
          v-if="showCursor"
          data-testid="stream-cursor"
          class="ml-0.5 inline-block w-[2px] h-[1em] align-middle animate-pulse"
          :style="{ backgroundColor: 'var(--accent)' }"
        />
      </div>

      <CitationsCard v-if="!isUser && message.citations?.length" :citations="message.citations ?? []" />

      <!-- 页脚：反馈 / 复制 / token（仅 assistant 且 done） -->
      <div
        v-if="!isUser && !message.streaming"
        class="mt-1 flex items-center gap-3 text-[11px]"
        :style="{ color: 'var(--foreground)' }"
      >
        <button
          data-testid="feedback-like"
          class="opacity-60 transition-opacity hover:opacity-100"
          :class="message.feedback === 'like' ? 'opacity-100' : ''"
          @click="onFeedback('like')"
        >👍</button>
        <button
          data-testid="feedback-dislike"
          class="opacity-60 transition-opacity hover:opacity-100"
          :class="message.feedback === 'dislike' ? 'opacity-100' : ''"
          @click="onFeedback('dislike')"
        >👎</button>
        <button class="opacity-60 transition-opacity hover:opacity-100" @click="onCopy">
          {{ copied ? '已复制' : '复制' }}
        </button>
        <span v-if="showTokens" class="font-mono opacity-50">
          {{ message.promptTokens }}/{{ message.completionTokens }}/{{ message.totalTokens }}
        </span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.prose-chat :deep(code) {
  font-family: var(--font-mono, monospace);
  background-color: var(--surface-secondary);
  padding: 0.1rem 0.3rem;
  border-radius: 0.25rem;
}
.prose-chat :deep(pre) {
  background-color: var(--surface-secondary);
  padding: 0.75rem;
  border-radius: 0.5rem;
  overflow-x: auto;
}
.prose-chat :deep(p) { margin: 0.4rem 0; }
.prose-chat :deep(ul), .prose-chat :deep(ol) { margin: 0.4rem 0; padding-left: 1.25rem; }
.prose-chat :deep(a) { color: var(--accent); text-decoration: underline; }
</style>
