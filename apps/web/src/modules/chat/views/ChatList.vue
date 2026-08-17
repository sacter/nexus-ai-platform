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
  <div class="flex h-full -m-6">
    <ChatSessionList @select="onSelect" @new="onNew" />
    <section class="flex flex-1 items-center justify-center">
      <ChatEmptyState
        title="开始一个新的对话"
        :suggestions="['新建会话', '查看历史对话', '了解知识库内容']"
        @suggest="onSuggest"
      />
    </section>
  </div>
</template>
