<script setup lang="ts">
import { useRouter } from 'vue-router'
import ChatSessionList from '@/modules/chat/components/ChatSessionList.vue'

const router = useRouter()

function handleSelect(id: string) { router.push(`/chat/${id}`) }
function handleNew() { router.push('/chat/new') }
</script>

<template>
  <div class="flex h-full -m-6">
    <ChatSessionList
      @select="handleSelect"
      @new="handleNew"
    />
    <div class="flex-1 flex items-center justify-center">
      <el-empty description="选择一个对话或新建" />
    </div>
  </div>
</template>
