import type { ChatMessage, ChatStreamEvent, MessagePhase } from '../types/chat'

export interface ReduceState {
  message: ChatMessage
  phase: MessagePhase
}

export function applyStreamEvent(prev: ReduceState, ev: ChatStreamEvent): ReduceState {
  const message: ChatMessage = { ...prev.message }
  let phase = prev.phase

  switch (ev.type) {
    case 'step': {
      const step = ev.data.step
      if (step === 'retrieval') phase = 'retrieving'
      else if (step === 'reranking') phase = 'reranking'
      else if (step === 'generating') phase = 'generating'
      message.phase = phase
      break
    }
    case 'citations':
      message.citations = ev.data
      break
    case 'delta': {
      phase = 'generating'
      message.phase = 'generating'
      const delta = ev.data.content
      message.content = (message.content ?? '') + delta
      break
    }
    case 'done': {
      const d = ev.data
      phase = 'done'
      message.streaming = false
      message.phase = 'done'
      if (d.messageId) message.id = d.messageId
      if (d.citations) message.citations = d.citations
      if (d.usage) {
        message.promptTokens = d.usage.promptTokens
        message.completionTokens = d.usage.completionTokens
        message.totalTokens = d.usage.totalTokens
      }
      break
    }
    case 'error': {
      const e = ev.data
      phase = 'error'
      message.streaming = false
      message.phase = 'error'
      message.error = e.message ?? '生成失败'
      break
    }
  }

  return { message, phase }
}
