import type { ChatStreamEvent } from '../types/chat'

export interface ChatStreamRequest {
  sessionId: string
  content: string
  signal?: AbortSignal
}

export interface ChatTransport {
  stream(req: ChatStreamRequest): AsyncGenerator<ChatStreamEvent, void, unknown>
}
