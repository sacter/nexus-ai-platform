<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import dayjs from 'dayjs'
import relativeTime from 'dayjs/plugin/relativeTime'
import { Bottom, ChatLineSquare, WarningFilled } from '@element-plus/icons-vue'
import { useChatSessions, useChatStream } from '../composables/useChat'
import ChatSessionList from '../components/ChatSessionList.vue'
import ChatMessage from '../components/ChatMessage.vue'
import ChatInput from '../components/ChatInput.vue'
import ChatStreamStatus from '../components/ChatStreamStatus.vue'
import ChatEmptyState from '../components/ChatEmptyState.vue'
import type { ChatSuggestion } from '../components/suggestions'
import type { ChatSession } from '../types/chat'

dayjs.extend(relativeTime)

const route = useRoute()
const router = useRouter()

// 用 ref + watch 跟随路由（/chat/new → createSession 后 router.replace 切到真 id），
// 保证 useChatStream 内部 toValue(sessionId) 在 done 失效时命中正确 query key
const sessionId = ref(String(route.params.sessionId ?? ''))
watch(() => route.params.sessionId, (v) => { sessionId.value = String(v ?? '') })
const { messages, phase, isStreaming, error, send, stop, sendFeedback } = useChatStream(sessionId)

const { data: sessionsData } = useChatSessions()
const currentSession = computed(() => (sessionsData.value ?? []).find((s) => s.id === sessionId.value))
const headerTitle = computed(() =>
  sessionId.value === 'new' ? '新会话' : (currentSession.value?.title ?? '对话'),
)
const headerMeta = computed(() => {
  const parts: string[] = []
  if (messages.value.length) parts.push(`${messages.value.length} 条消息`)
  if (currentSession.value?.createdAt) parts.push(dayjs(currentSession.value.createdAt).fromNow())
  return parts.join(' · ')
})

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

// 用户点击「回到底部」浮动按钮：强制滚动并恢复贴底状态。
// scrollToBottom 的 isNearBottom 守卫会让按钮点击变成 no-op——按钮只在 isNearBottom=false 时渲染，
// 直接复用 scrollToBottom 会因守卫失败而不滚动（最终评审发现的 Important 回归）。
async function backToBottom() {
  isNearBottom.value = true
  showScrollBtn.value = false
  await nextTick()
  const el = threadRef.value
  if (el) el.scrollTop = el.scrollHeight
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
function onCreated(session: ChatSession) { router.push(`/chat/${session.id}`) }
function onSuggest(s: ChatSuggestion) { send(s.text) }
function onFeedback(messageId: string, action: 'like' | 'dislike') { sendFeedback(messageId, action) }
</script>

<template>
  <div
    class="chat-island flex h-full min-h-[480px] overflow-hidden rounded-xl border"
    :style="{ borderColor: 'var(--border)', backgroundColor: 'var(--surface)' }"
  >
    <ChatSessionList :active-id="sessionId" @select="onSelect" @created="onCreated" />

    <section class="relative flex min-w-0 flex-1 flex-col">
      <header
        class="flex items-center justify-between gap-3 border-b px-4 py-3"
        :style="{ borderColor: 'var(--border)' }"
      >
        <div class="flex min-w-0 items-center gap-2.5">
          <span
            class="flex h-6 w-6 shrink-0 items-center justify-center rounded-md"
            style="background: var(--brand-gradient)"
          >
            <el-icon :size="13" color="var(--accent-foreground)" aria-hidden="true"><ChatLineSquare /></el-icon>
          </span>
          <h2 class="truncate text-sm font-semibold" :style="{ color: 'var(--foreground)' }">
            {{ headerTitle }}
          </h2>
        </div>
        <span
          v-if="headerMeta"
          class="num shrink-0 text-[11px]"
          :style="{ color: 'var(--foreground)', opacity: 0.5 }"
        >{{ headerMeta }}</span>
      </header>

      <div ref="threadRef" class="relative flex-1 overflow-y-auto px-4 py-4" @scroll="onScroll">
        <div class="mx-auto w-full max-w-[760px]">
          <div
            v-if="error"
            class="my-2 flex items-center gap-2 rounded-lg px-3 py-2 text-sm"
            :style="{ backgroundColor: 'var(--el-color-error-light-9)', color: 'var(--el-color-error)' }"
          >
            <el-icon :size="14" aria-hidden="true"><WarningFilled /></el-icon>
            <span class="min-w-0 flex-1">{{ error }}</span>
            <el-button
              v-if="messages.length >= 2"
              size="small"
              text
              type="danger"
              @click="send(messages[messages.length-2]?.content ?? '')"
            >重试</el-button>
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
      </div>

      <button
        v-if="showScrollBtn"
        class="absolute bottom-24 right-6 flex items-center gap-1 rounded-full border px-3 py-1 text-xs shadow"
        :style="{ borderColor: 'var(--border)', backgroundColor: 'var(--surface)', color: 'var(--foreground)' }"
        @click="backToBottom"
      >
        <el-icon :size="12" aria-hidden="true"><Bottom /></el-icon>回到底部
      </button>

      <ChatInput :streaming="isStreaming" @send="send" @stop="stop" />
    </section>
  </div>
</template>

<style scoped>
.msg-enter-active { transition: opacity var(--dur-base) var(--ease-out), transform var(--dur-base) var(--ease-out); }
.msg-enter-from { opacity: 0; transform: translateY(6px); }
</style>
