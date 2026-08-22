import { computed, onScopeDispose, ref, watch, type MaybeRef, toValue, type Ref } from 'vue'
import { useQuery, useMutation, useQueryClient } from '@tanstack/vue-query'
import { chatApi, type CreateSessionPayload } from '@/modules/chat/api/chat.api'
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

export function useCreateChatSession() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: CreateSessionPayload) => chatApi.createSession(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['chat-sessions'] })
    },
  })
}

export function useChatMessages(sessionId: MaybeRef<string>) {
  return useQuery({
    // 传 ref（非 toValue 快照）让 vue-query 跟踪并按解包值 hash；done 失效 ['chat-messages', sid] 可命中
    queryKey: ['chat-messages', sessionId],
    queryFn: () => chatApi.getMessages(toValue(sessionId)),
    enabled: () => !!toValue(sessionId),
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

  const history = useChatMessages(sessionId)
  const messages = ref<ChatMessage[]>([]) as Ref<ChatMessage[]>
  const streamingMessage = ref<ChatMessage | null>(null)
  const phase = ref<MessagePhase>('idle')
  const error = ref<string | null>(null)
  const isStreaming = computed(
    () => phase.value === 'retrieving' || phase.value === 'reranking' || phase.value === 'generating',
  )

  let abortController: AbortController | null = null

  watch(
    () => history.data.value,
    (data) => {
      // 仅当后端历史非空到达才替换线程；流式期间或历史拉取失败（无后端）时保留当前内容（spec §3.4，避免清空刚生成内容）
      if (!isStreaming.value && data && data.length) {
        // done 后历史失效会回流与当前一致的线程；长度+末条 id 相同时跳过替换，
        // 避免 TransitionGroup 因对象引用全换而重放进入动画（用户气泡 tempId→id 闪动）
        const cur = messages.value
        const sameShape = cur.length === data.length
          && cur.length > 0
          && cur[cur.length - 1].id === data[data.length - 1].id
        if (!sameShape) {
          messages.value = data.map((m) => ({ ...m }))
          streamingMessage.value = null
        }
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
    console.log('send:', text);
    
    if (!text || isStreaming.value) return
    error.value = null
    // 重试清理：末尾若是失败/中断的助手占位（streaming 关、phase error/aborted），
    // 连同其前导用户消息一并移除，避免重试时重复堆叠用户气泡与残留错误占位
    {
      const arr = messages.value
      const last = arr[arr.length - 1]
      if (last && last.role === 'assistant' && last.streaming === false && (last.phase === 'error' || last.phase === 'aborted')) {
        const prev = arr[arr.length - 2]
        messages.value = prev && prev.role === 'user' ? arr.slice(0, -2) : arr.slice(0, -1)
      }
    }
    const sid = toValue(sessionId)
    // 局部闭包捕获 sid：done 时按真实 sid 失效历史查询
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

  // 离开页面/组件卸载时中止进行中的流：触发 AbortController → fetch-sse finally 的 reader.cancel()，
  // 避免导航离开后残留 SSE 连接，以及生成器继续向已分离的 ref 写入（最终评审发现的 Important 泄漏）
  onScopeDispose(() => stop())

  return { messages, streamingMessage, phase, isStreaming, error, send, stop, sendFeedback }
}
