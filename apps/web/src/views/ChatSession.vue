<script setup lang="ts">
import { ref } from 'vue'
import { useRoute } from 'vue-router'
import { useChatMessages, useSendMessage } from '@/composables/use-chat'
import ChatSessionList from '@/components/chat/ChatSessionList.vue'
import ChatMessage from '@/components/chat/ChatMessage.vue'
import ChatInput from '@/components/chat/ChatInput.vue'

const route = useRoute()
const sessionId = ref(route.params.sessionId as string)
const { data: messages } = useChatMessages(sessionId)
const sendMutation = useSendMessage()

function handleSend(content: string) {
  sendMutation.mutate({ sessionId: sessionId.value, content })
}
</script>

<template>
  <div class="flex h-full -m-6">
    <ChatSessionList :active-id="sessionId" />
    <div class="flex-1 flex flex-col">
      <div class="flex-1 overflow-y-auto p-4">
        <div v-if="messages && Array.isArray(messages) && messages.length > 0">
          <ChatMessage
            v-for="(msg, i) in messages"
            :key="i"
            :role="(msg as Record<string,string>).role as 'user' | 'assistant'"
            :content="(msg as Record<string,string>).content"
          />
        </div>
        <el-empty v-else description="开始对话吧" />
      </div>
      <ChatInput @send="handleSend" />
    </div>
  </div>
</template>
