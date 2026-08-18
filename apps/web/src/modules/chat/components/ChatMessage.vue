<script setup lang="ts">
import { computed } from 'vue'
import { useClipboard } from '@vueuse/core'
import { CopyDocument } from '@element-plus/icons-vue'
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
  <div class="flex py-1.5" :class="isUser ? 'justify-end' : ''">
    <!-- 用户消息：accent 气泡（accent-foreground 修复深色 uber 白底白字） -->
    <div
      v-if="isUser"
      class="max-w-[75%] whitespace-pre-wrap break-words rounded-2xl rounded-br-md px-4 py-2 text-sm leading-relaxed"
      :style="{ backgroundColor: 'var(--accent)', color: 'var(--accent-foreground)' }"
    >{{ message.content }}</div>

    <!-- 助手消息：平铺无气泡 -->
    <div v-else class="w-full min-w-0">
      <div class="text-sm leading-relaxed" :style="{ color: 'var(--foreground)' }">
        <div class="prose-chat" v-html="html" />
        <span
          v-if="showCursor"
          data-testid="stream-cursor"
          class="ml-0.5 inline-block w-[2px] h-[1em] align-middle animate-pulse"
          :style="{ backgroundColor: 'var(--accent)' }"
        />
      </div>

      <CitationsCard v-if="message.citations?.length" :citations="message.citations ?? []" />

      <!-- 页脚：反馈 / 复制 / token（仅 done） -->
      <div
        v-if="!message.streaming"
        class="mt-2 flex items-center gap-3 text-xs"
        :style="{ color: 'var(--foreground)' }"
      >
        <button
          data-testid="feedback-like"
          aria-label="赞"
          :aria-pressed="message.feedback === 'like'"
          class="transition-opacity hover:opacity-100"
          :class="message.feedback === 'like' ? 'opacity-100' : 'opacity-40'"
          :style="message.feedback === 'like' ? { color: 'var(--accent)' } : {}"
          @click="onFeedback('like')"
        >
          <svg aria-hidden="true" focusable="false" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="h-3.5 w-3.5"><path d="M7 10v12" /><path d="M15 5.88 14 10h5.83a2 2 0 0 1 1.92 2.56l-2.33 8A2 2 0 0 1 17.5 22H4a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2h2.76a2 2 0 0 0 1.79-1.11L12 2a3.13 3.13 0 0 1 3 3.88Z" /></svg>
        </button>
        <button
          data-testid="feedback-dislike"
          aria-label="踩"
          :aria-pressed="message.feedback === 'dislike'"
          class="transition-opacity hover:opacity-100"
          :class="message.feedback === 'dislike' ? 'opacity-100' : 'opacity-40'"
          :style="message.feedback === 'dislike' ? { color: 'var(--accent)' } : {}"
          @click="onFeedback('dislike')"
        >
          <svg aria-hidden="true" focusable="false" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="h-3.5 w-3.5 rotate-180"><path d="M7 10v12" /><path d="M15 5.88 14 10h5.83a2 2 0 0 1 1.92 2.56l-2.33 8A2 2 0 0 1 17.5 22H4a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2h2.76a2 2 0 0 0 1.79-1.11L12 2a3.13 3.13 0 0 1 3 3.88Z" /></svg>
        </button>
        <button
          :aria-label="copied ? '已复制' : '复制'"
          class="flex items-center gap-1 opacity-40 transition-opacity hover:opacity-100"
          @click="onCopy"
        >
          <el-icon :size="13"><CopyDocument /></el-icon>
          <span>{{ copied ? '已复制' : '复制' }}</span>
        </button>
        <span v-if="showTokens" class="num opacity-50">
          {{ message.promptTokens }}/{{ message.completionTokens }}/{{ message.totalTokens }}
        </span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.prose-chat :deep(h1),
.prose-chat :deep(h2),
.prose-chat :deep(h3) {
  font-family: var(--font-display);
  font-weight: 600;
  letter-spacing: -0.01em;
  margin: 0.8rem 0 0.4rem;
}
.prose-chat :deep(h1) { font-size: 1.15rem; }
.prose-chat :deep(h2) { font-size: 1.05rem; }
.prose-chat :deep(h3) { font-size: 0.95rem; }
.prose-chat :deep(p) { margin: 0.4rem 0; }
.prose-chat :deep(ul), .prose-chat :deep(ol) { margin: 0.4rem 0; padding-left: 1.25rem; }
.prose-chat :deep(a) { color: var(--accent); text-decoration: underline; }
.prose-chat :deep(code) {
  font-family: var(--font-mono, monospace);
  background-color: var(--surface-secondary);
  padding: 0.1rem 0.3rem;
  border-radius: 0.25rem;
}
.prose-chat :deep(pre) {
  background-color: var(--surface-secondary);
  border: 1px solid var(--border);
  padding: 0.75rem;
  border-radius: 0.5rem;
  overflow-x: auto;
}
.prose-chat :deep(pre code) { background: transparent; padding: 0; }
.prose-chat :deep(blockquote) {
  margin: 0.5rem 0;
  padding: 0.25rem 0.75rem;
  border-left: 3px solid var(--accent);
  background: var(--accent-soft);
  border-radius: 0 0.375rem 0.375rem 0;
}
.prose-chat :deep(table) { border-collapse: collapse; margin: 0.5rem 0; width: 100%; }
.prose-chat :deep(th), .prose-chat :deep(td) {
  border: 1px solid var(--border);
  padding: 0.3rem 0.6rem;
  text-align: left;
}
.prose-chat :deep(tbody tr:nth-child(odd)) { background: var(--surface-secondary); }
.prose-chat :deep(hr) { border: 0; border-top: 1px solid var(--border); margin: 0.8rem 0; }
</style>
