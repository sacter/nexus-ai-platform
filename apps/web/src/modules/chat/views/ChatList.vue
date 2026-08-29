<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import ChatSessionList from '../components/ChatSessionList.vue'
import ChatEmptyState from '../components/ChatEmptyState.vue'
import type { ChatSuggestion } from '../components/suggestions'
import type { ChatSession } from '../types/chat'

const router = useRouter()

// 结构式类型锁定 defineExpose 的 openDialog（不依赖 vue-tsc 对 expose 的推导版本）
const sessionListRef = ref<{ openDialog: (prefill?: { title?: string }) => void } | null>(null)

function onSelect(id: string) { router.push(`/chat/${id}`) }
// 建议卡片 = 消息引导；在欢迎页点击时只取 title 预填会话标题（修复原来 text 被丢弃的问题）
function onSuggest(s: ChatSuggestion) { sessionListRef.value?.openDialog({ title: s.title }) }
function onCreated(session: ChatSession) { router.push(`/chat/${session.id}`) }
</script>

<template>
  <div
    class="chat-island flex h-full min-h-[480px] overflow-hidden rounded-xl border"
    :style="{ borderColor: 'var(--border)', backgroundColor: 'var(--surface)' }"
  >
    <ChatSessionList ref="sessionListRef" @select="onSelect" @created="onCreated" />
    <section class="flex min-w-0 flex-1 items-center justify-center">
      <ChatEmptyState title="开始一个新的对话" @suggest="onSuggest" />
    </section>
  </div>
</template>
