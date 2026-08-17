import type { ChatStreamEvent } from '../types/chat'
import type { ChatStreamRequest, ChatTransport } from './chat-transport'

export interface FetchSseOptions {
  baseUrl: string
  getToken: () => string | null
}

export class FetchSseChatTransport implements ChatTransport {
  constructor(
    private readonly opts: FetchSseOptions,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  async *stream(req: ChatStreamRequest): AsyncGenerator<ChatStreamEvent, void, unknown> {
    const token = this.opts.getToken()
    const res: Response = await this.fetchImpl(
      `${this.opts.baseUrl}/chat/sessions/${req.sessionId}/messages`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ content: req.content }),
        signal: req.signal,
      },
    )

    if (!res.ok || !res.body) {
      yield { type: 'error', data: { message: `HTTP ${res.status}` } }
      return
    }

    const reader = res.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''
    try {
      while (true) {
        const { value, done } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true }).replace(/\r\n/g, '\n')
        let idx: number
        while ((idx = buffer.indexOf('\n\n')) >= 0) {
          const chunk = buffer.slice(0, idx)
          buffer = buffer.slice(idx + 2)
          const dataStr = chunk
            .split('\n')
            .filter((l) => l.startsWith('data:'))
            .map((l) => l.slice(5).trim())
            .join('\n')
          if (!dataStr) continue
          if (dataStr === '[DONE]') return
          try {
            yield JSON.parse(dataStr) as ChatStreamEvent
          } catch {
            // 跳过格式异常的事件
          }
        }
      }
    } finally {
      reader.releaseLock()
    }
  }
}
