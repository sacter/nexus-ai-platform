import { describe, it, expect } from 'vitest'
import { MockSseChatTransport } from '../transport/mock-sse.transport'

describe('MockSseChatTransport', () => {
  // 用真实定时器 + 极小延迟（stepDelay/deltaDelay）；fake timers 下 for-await 会阻塞在 sleep 上导致超时
  it('emits step → citations → step → delta* → done sequence', async () => {
    const transport = new MockSseChatTransport({ stepDelay: 1, deltaDelay: 1 })
    const events = []
    for await (const ev of transport.stream({ sessionId: 's1', content: 'hi' })) events.push(ev)
    const types = events.map(e => e.type)
    expect(types[0]).toBe('step')
    expect(types[1]).toBe('citations')
    expect(types[2]).toBe('step')
    expect(types.filter(t => t === 'delta').length).toBeGreaterThan(0)
    expect(types[types.length - 1]).toBe('done')
    const done = events.find(e => e.type === 'done')!
    expect((done.data as any).usage.totalTokens).toBeGreaterThan(0)
    expect((done.data as any).messageId).toBeTruthy()
  })

  it('stops emitting after abort', async () => {
    const ctrl = new AbortController()
    const transport = new MockSseChatTransport({ stepDelay: 1, deltaDelay: 1 })
    const types: string[] = []
    for await (const ev of transport.stream({ sessionId: 's1', content: 'hi', signal: ctrl.signal })) {
      types.push(ev.type)
      if (types.length === 2) ctrl.abort()
    }
    expect(types.length).toBeLessThanOrEqual(5)
    expect(types[types.length - 1]).not.toBe('done')
  })
})
