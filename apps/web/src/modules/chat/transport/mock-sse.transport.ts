import type { ChatStreamEvent } from '../types/chat'
import type { ChatStreamRequest, ChatTransport } from './chat-transport'

const ANSWER =
  '根据员工手册，请假需提前提交申请，流程如下：\n\n1. 提前 3 个工作日提交请假申请\n2. 直属主管审批\n3. HR 备案'

const CITATIONS = [
  { documentName: '员工手册.pdf', page: 12, snippet: '员工请假需提前 3 个工作日提交申请…', score: 0.92 },
  { documentName: '考勤制度.pdf', page: 3, snippet: '请假申请步骤：提交→审批→备案…', score: 0.85 },
]

const sleep = (ms: number, signal?: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    if (signal?.aborted) return reject(new DOMException('Aborted', 'AbortError'))
    const t = setTimeout(resolve, ms)
    signal?.addEventListener('abort', () => { clearTimeout(t); reject(new DOMException('Aborted', 'AbortError')) })
  })

export class MockSseChatTransport implements ChatTransport {
  constructor(private readonly opts: { stepDelay?: number; deltaDelay?: number } = {}) {}

  async *stream(req: ChatStreamRequest): AsyncGenerator<ChatStreamEvent, void, unknown> {
    const signal = req.signal
    const aborted = () => signal?.aborted === true
    const stepDelay = this.opts.stepDelay ?? 400
    const deltaDelay = this.opts.deltaDelay ?? 120
    try {
      yield { type: 'step', data: { step: 'retrieval', message: '正在检索知识库…' } }
      await sleep(stepDelay, signal)
      if (aborted()) return
      yield { type: 'citations', data: CITATIONS }
      yield { type: 'step', data: { step: 'generating', message: '正在生成回答…' } }
      const parts = ANSWER.match(/[\s\S]{1,18}/g) ?? [ANSWER]
      for (const p of parts) {
        if (aborted()) return
        await sleep(deltaDelay, signal)
        yield { type: 'delta', data: { content: p } }
      }
      if (aborted()) return
      yield {
        type: 'done',
        data: {
          messageId: crypto.randomUUID(),
          usage: { promptTokens: 420, completionTokens: 120, totalTokens: 540 },
          citations: CITATIONS,
        },
      }
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') return
      yield { type: 'error', data: { message: 'mock 错误' } }
    }
  }
}
