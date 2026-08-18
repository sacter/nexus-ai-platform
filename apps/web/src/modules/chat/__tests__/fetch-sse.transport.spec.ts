import { describe, it, expect } from 'vitest'
import { FetchSseChatTransport } from '../transport/fetch-sse.transport'

// 构造一个 fake ReadableStream，吐出 SSE 字节
function sseBody(chunks: string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder()
  return new ReadableStream({
    start(controller) {
      for (const c of chunks) controller.enqueue(encoder.encode(c))
      controller.close()
    },
  })
}

describe('FetchSseChatTransport', () => {
  it('parses {type,data} events and yields them in order', async () => {
    const payload = [
      'data: {"type":"step","data":{"step":"retrieval","message":"检索中"}}\n\n',
      'data: {"type":"delta","data":{"content":"Hello"}}\n\n',
      'data: {"type":"delta","data":{"content":" world"}}\n\n',
      'data: {"type":"done","data":{"messageId":"m1","usage":{"promptTokens":1,"completionTokens":2,"totalTokens":3}}}\n\n',
      'data: [DONE]\n\n',
    ].join('')
    const fakeFetch = (() => Promise.resolve({
      ok: true,
      body: sseBody([payload]),
    } as unknown as Response)) as unknown as typeof fetch

    const transport = new FetchSseChatTransport(
      { baseUrl: 'http://x', getToken: () => 'tok' },
      fakeFetch,
    )
    const events = []
    for await (const ev of transport.stream({ sessionId: 's1', content: 'hi' })) events.push(ev)
    expect(events.map(e => e.type)).toEqual(['step', 'delta', 'delta', 'done'])
    expect(events[1].data).toEqual({ content: 'Hello' })
    expect((events[3].data as any).messageId).toBe('m1')
  })

  it('yields an error event on non-ok response', async () => {
    const fakeFetch = (() => Promise.resolve({ ok: false, status: 500, body: null } as unknown as Response)) as unknown as typeof fetch
    const transport = new FetchSseChatTransport({ baseUrl: 'http://x', getToken: () => null }, fakeFetch)
    const events = []
    for await (const ev of transport.stream({ sessionId: 's1', content: 'hi' })) events.push(ev)
    expect(events).toHaveLength(1)
    expect(events[0].type).toBe('error')
  })

  it('reassembles an event split across multiple read chunks', async () => {
    // 同一事件的 data 行被切到两个 chunk（边界落在 JSON 中间），验证 buffer 重组
    const chunks = [
      'data: {"type":"step","data":{"step":"retr',
      'ieval","message":"检索中"}}\n\n',
      'data: {"type":"done","data":{"messageId":"m9"}}\n\n',
    ]
    const fakeFetch = (() => Promise.resolve({
      ok: true,
      body: sseBody(chunks),
    } as unknown as Response)) as unknown as typeof fetch

    const transport = new FetchSseChatTransport(
      { baseUrl: 'http://x', getToken: () => null },
      fakeFetch,
    )
    const events = []
    for await (const ev of transport.stream({ sessionId: 's1', content: 'hi' })) events.push(ev)
    expect(events.map(e => e.type)).toEqual(['step', 'done'])
    expect((events[0].data as any).step).toBe('retrieval')
    expect((events[1].data as any).messageId).toBe('m9')
  })

  it('yields the final event even without a trailing blank line (decoder flush + tail recovery)', async () => {
    // 服务器在最后一个事件后直接关闭流（无 [DONE]、无尾随 \n\n）：
    // 兜底分支须 flush TextDecoder 并解析 buffer 拋留，否则 done 丢失致 UI 卡在流式态
    const payload = 'data: {"type":"done","data":{"messageId":"m7"}}'
    const fakeFetch = (() => Promise.resolve({
      ok: true,
      body: sseBody([payload]),
    } as unknown as Response)) as unknown as typeof fetch
    const transport = new FetchSseChatTransport(
      { baseUrl: 'http://x', getToken: () => null },
      fakeFetch,
    )
    const events = []
    for await (const ev of transport.stream({ sessionId: 's1', content: 'hi' })) events.push(ev)
    expect(events.map(e => e.type)).toEqual(['done'])
    expect((events[0].data as any).messageId).toBe('m7')
  })
})
