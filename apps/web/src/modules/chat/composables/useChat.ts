import { computed, ref, watch, type MaybeRef, toValue, type Ref } from 'vue'
import { useQuery, useMutation, useQueryClient } from '@tanstack/vue-query'
import { useRouter } from 'vue-router'
import { chatApi } from '@/modules/chat/api/chat.api'
import { applyStreamEvent } from './chat-stream-reducer'
import { FetchSseChatTransport } from '../transport/fetch-sse.transport'
import { MockSseChatTransport } from '../transport/mock-sse.transport'
import type { ChatMessage, ChatStreamEvent, MessagePhase } from '../types/chat'
import type { ChatTransport, ChatStreamRequest } from '../transport/chat-transport'

const API_BASE = import.meta.env.VITE_API_URL || '/api/v1'

export function createChatTransport(): ChatTransport {
  if (import.meta.env.VITE_CHAT_MOCK === '1') return new MockSseChatTransport()
  return new FetchSseChatTransport({ baseUrl: API_BASE, getToken: () => localStorage.getItem('token') })
}

export function useChatSessions() {
  return useQuery({ queryKey: ['chat-sessions'], queryFn: () => chatApi.listSessions() })
}

export function useChatMessages(sessionId: MaybeRef<string>) {
  return useQuery({
    // 传 ref（非 toValue 快照）让 vue-query 跟踪并按解包值 hash；done 失效 ['chat-messages', sid] 可命中
    queryKey: ['chat-messages', sessionId],
    queryFn: () => chatApi.getMessages(toValue(sessionId)),
    enabled: () => !!toValue(sessionId) && toValue(sessionId) !== 'new',
  })
}

export function useSendMessage() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ sessionId, content }: { sessionId: string; content: string }) =>
      chatApi.sendMessage(sessionId, content),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['chat-messages', variables.sessionId] })
    },
  })
}

export interface ChatStreamHandle {
  messages: Ref<ChatMessage[]>
  streamingMessage: Ref<ChatMessage | null>
  phase: Ref<MessagePhase>
  isStreaming: Ref<boolean>
  error: Ref<string | null>
  send: (content: string) => Promise<void>
  stop: () => void
  sendFeedback: (messageId: string, action: 'like' | 'dislike') => Promise<void>
}

export function useChatStream(sessionId: MaybeRef<string>, opts?: { transport?: ChatTransport }): ChatStreamHandle {
  const transport = opts?.transport ?? createChatTransport()
  const qc = useQueryClient()
  const router = useRouter()

  const history = useChatMessages(sessionId)
  const messages = ref<ChatMessage[]>([]) as Ref<ChatMessage[]>
  const streamingMessage = ref<ChatMessage | null>(null)
  const phase = ref<MessagePhase>('idle')
  const error = ref<string | null>(null)
  const isStreaming = computed(
    () => phase.value === 'pendingCreate' || phase.value === 'retrieving' || phase.value === 'reranking' || phase.value === 'generating',
  )

  let abortController: AbortController | null = null

  watch(
    () => history.data.value,
    (data) => {
      // 仅当后端历史非空到达才替换线程；流式期间或历史拉取失败（无后端）时保留当前内容（spec §3.4，避免清空刚生成内容）
      if (!isStreaming.value && data && data.length) {
        messages.value = data.map((m) => ({ ...m }))
        streamingMessage.value = null
      }
    },
    { immediate: true },
  )

  function syncLast(msg: ChatMessage) {
    const arr = messages.value
    if (arr.length && arr[arr.length - 1].tempId === msg.tempId) {
      arr[arr.length - 1] = msg
    }
  }

  async function send(content: string) {
    const text = content.trim()
    if (!text || isStreaming.value) return
    error.value = null
    let sid = toValue(sessionId)
    if (sid === 'new') {
      phase.value = 'pendingCreate'
      try {
        const session = await chatApi.createSession()
        sid = session.id
        router.replace(`/chat/${sid}`)
      } catch {
        phase.value = 'error'
        error.value = '创建会话失败'
        return
      }
    }
    // 局部闭包捕获 sid：done 时按真实 sid 失效历史查询（避免路由尚未更新时命中 'new'）
    const handleEvent = (ev: ChatStreamEvent) => {
      if (!streamingMessage.value) return
      const state = applyStreamEvent({ message: streamingMessage.value, phase: phase.value }, ev)
      phase.value = state.phase
      streamingMessage.value = state.message
      syncLast(state.message)
      if (ev.type === 'done') {
        qc.invalidateQueries({ queryKey: ['chat-messages', sid] })
      }
    }

    abortController = new AbortController()
    const tempId = `temp-${Math.random().toString(36).slice(2)}`
    const placeholder: ChatMessage = {
      tempId, sessionId: sid, role: 'assistant', content: '',
      streaming: true, phase: 'retrieving', citations: [],
    }
    const userMsg: ChatMessage = {
      tempId: `u-${Math.random().toString(36).slice(2)}`, sessionId: sid, role: 'user', content: text,
    }
    messages.value = [...messages.value, userMsg, placeholder]
    streamingMessage.value = placeholder
    phase.value = 'retrieving'
    try {
      const req: ChatStreamRequest = { sessionId: sid, content: text, signal: abortController.signal }
      for await (const ev of transport.stream(req)) handleEvent(ev)
    } catch (e: any) {
      if (e?.name === 'AbortError') {
        phase.value = 'aborted'
        if (streamingMessage.value) {
          streamingMessage.value = { ...streamingMessage.value, streaming: false, phase: 'aborted' }
          syncLast(streamingMessage.value)
        }
      } else {
        phase.value = 'error'
        error.value = e?.message ?? '网络错误'
        if (streamingMessage.value) {
          const updated: ChatMessage = { ...streamingMessage.value, streaming: false, phase: 'error', error: error.value ?? undefined }
          streamingMessage.value = updated
          syncLast(updated)
        }
      }
    } finally {
      abortController = null
    }
  }

  function stop() {
    abortController?.abort()
  }

  async function sendFeedback(messageId: string, action: 'like' | 'dislike') {
    await chatApi.sendFeedback(messageId, action)
    const m = messages.value.find((x) => x.id === messageId)
    if (m) m.feedback = action
  }

  return { messages, streamingMessage, phase, isStreaming, error, send, stop, sendFeedback }
}
