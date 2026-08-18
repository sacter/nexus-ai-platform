<script setup lang="ts">
import { useRouter } from 'vue-router'
import ChatSessionList from '../components/ChatSessionList.vue'
import ChatEmptyState from '../components/ChatEmptyState.vue'

const router = useRouter()
function onSelect(id: string) { router.push(`/chat/${id}`) }
function onNew() { router.push('/chat/new') }
function onSuggest() { onNew() }
</script>

<template>
  <div
    class="chat-island flex h-full min-h-[480px] overflow-hidden rounded-xl border"
    :style="{ borderColor: 'var(--border)', backgroundColor: 'var(--surface)' }"
  >
    <ChatSessionList @select="onSelect" @new="onNew" />
    <section class="flex min-w-0 flex-1 items-center justify-center">
      <ChatEmptyState title="开始一个新的对话" @suggest="onSuggest" />
    </section>
  </div>
</template>
