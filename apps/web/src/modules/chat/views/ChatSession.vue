<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useChatStream } from '../composables/useChat'
import ChatSessionList from '../components/ChatSessionList.vue'
import ChatMessage from '../components/ChatMessage.vue'
import ChatInput from '../components/ChatInput.vue'
import ChatStreamStatus from '../components/ChatStreamStatus.vue'
import ChatEmptyState from '../components/ChatEmptyState.vue'

const route = useRoute()
const router = useRouter()

// 用 ref + watch 跟随路由（/chat/new → createSession 后 router.replace 切到真 id），
// 保证 useChatStream 内部 toValue(sessionId) 在 done 失效时命中正确 query key
const sessionId = ref(String(route.params.sessionId ?? ''))
watch(() => route.params.sessionId, (v) => { sessionId.value = String(v ?? '') })
const { messages, phase, isStreaming, error, send, stop, sendFeedback } = useChatStream(sessionId)

const threadRef = ref<HTMLElement | null>(null)
const showScrollBtn = ref(false)
const isNearBottom = ref(true)

const isEmpty = computed(() => !isStreaming.value && messages.value.length === 0)

async function scrollToBottom() {
  await nextTick()
  const el = threadRef.value
  // 仅当用户贴底时自动滚动；用户上滑查阅时不打断（避免流式增量把视图拽回底部）
  if (el && isNearBottom.value) el.scrollTop = el.scrollHeight
}

watch(() => messages.value.length, scrollToBottom)
// 流式增量时也贴底
watch(
  () => messages.value[messages.value.length - 1]?.content,
  scrollToBottom,
)

function onScroll() {
  const el = threadRef.value
  if (!el) return
  const near = el.scrollTop + el.clientHeight >= el.scrollHeight - 80
  isNearBottom.value = near
  showScrollBtn.value = !near
}

function onSelect(id: string) { router.push(`/chat/${id}`) }
function onNew() { router.push('/chat/new') }
function onSuggest(text: string) { send(text) }
function onFeedback(messageId: string, action: 'like' | 'dislike') { sendFeedback(messageId, action) }
</script>

<template>
  <div class="flex h-full -m-6">
    <ChatSessionList :active-id="sessionId" @select="onSelect" @new="onNew" />

    <section class="relative flex flex-1 flex-col">
      <header
        class="flex items-center justify-between border-b px-4 py-3"
        :style="{ borderColor: 'var(--border)', backgroundColor: 'var(--surface)' }"
      >
        <span class="text-sm font-medium" :style="{ color: 'var(--foreground)' }">
          {{ sessionId === 'new' ? '新会话' : '对话' }}
        </span>
      </header>

      <div ref="threadRef" class="relative flex-1 overflow-y-auto px-4 py-4" @scroll="onScroll">
        <div v-if="error" class="my-2 rounded-lg px-3 py-2 text-sm text-red-500" style="background: var(--accent-soft)">
          {{ error }}
          <button v-if="messages.length >= 2" class="underline" @click="send(messages[messages.length-2]?.content ?? '')">重试</button>
        </div>

        <ChatEmptyState v-if="isEmpty" @suggest="onSuggest" />

        <template v-else>
          <ChatStreamStatus :phase="phase" />
          <TransitionGroup name="msg" tag="div">
            <ChatMessage
              v-for="m in messages"
              :key="m.id ?? m.tempId"
              :message="m"
              @feedback="onFeedback"
            />
          </TransitionGroup>
        </template>
      </div>

      <button
        v-if="showScrollBtn"
        class="absolute bottom-24 right-6 rounded-full border px-3 py-1 text-xs shadow"
        :style="{ borderColor: 'var(--border)', backgroundColor: 'var(--surface)' }"
        @click="scrollToBottom"
      >↓ 回到底部</button>

      <ChatInput :streaming="isStreaming" @send="send" @stop="stop" />
    </section>
  </div>
</template>

<style scoped>
.msg-enter-active { transition: opacity 200ms ease-out, transform 200ms ease-out; }
.msg-enter-from { opacity: 0; transform: translateY(6px); }
</style>
