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
    // 从一个 SSE 事件块（可能多行 data:）抽取并拼接 data 负载
    const extractData = (chunk: string): string =>
      chunk
        .split('\n')
        .filter((l) => l.startsWith('data:'))
        .map((l) => l.slice(5).trim())
        .join('\n')
    // 解析单个 data 负载；空负载由调用方处理，这里只兜底 JSON 异常
    const parseEvent = (dataStr: string): ChatStreamEvent | null => {
      if (!dataStr) return null
      try {
        return JSON.parse(dataStr) as ChatStreamEvent
      } catch {
        // 跳过格式异常的事件，但留下诊断日志
        console.warn('[fetch-sse] malformed SSE event skipped:', dataStr)
        return null
      }
    }
    try {
      while (true) {
        const { value, done } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true }).replace(/\r\n/g, '\n')
        let idx: number
        while ((idx = buffer.indexOf('\n\n')) >= 0) {
          const dataStr = extractData(buffer.slice(0, idx))
          buffer = buffer.slice(idx + 2)
          if (dataStr === '[DONE]') return
          const ev = parseEvent(dataStr)
          if (ev) yield ev
        }
      }
      // flush TextDecoder 残留字节 + 兜底未以 \n\n 终止的最后一个事件：
      // spec 服务器以 [DONE]\n\n 收尾，此处仅作健壮性兜底，避免丢 done 致 UI 卡在流式态
      const tail = decoder.decode().replace(/\r\n/g, '\n')
      if (tail) buffer += tail
      if (buffer.trim()) {
        const dataStr = extractData(buffer)
        if (dataStr === '[DONE]') return
        const ev = parseEvent(dataStr)
        if (ev) yield ev
      }
    } finally {
      // cancel（非 releaseLock）真正中止底层流，避免 abort 后 TCP 泄漏；
      // 流可能已关闭/errored，cancel 自身的拒绝不可掩盖原始异常
      try { await reader.cancel() } catch { /* already closed/errored */ }
    }
  }
}
