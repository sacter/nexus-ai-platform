import { describe, it, expect } from 'vitest'
import { defineComponent, h, ref, type Ref } from 'vue'
import { mount } from '@vue/test-utils'
import { VueQueryPlugin, QueryClient } from '@tanstack/vue-query'
import { createMemoryHistory, createRouter } from 'vue-router'
import { useChatStream } from '../composables/useChat'
import type { ChatTransport, ChatStreamRequest } from '../transport/chat-transport'
import type { ChatStreamEvent } from '../types/chat'

// flush 微任务（历史查询 settle + async generator 推进）
const flush = () => new Promise((r) => setTimeout(r, 0))

function fakeTransport(events: ChatStreamEvent[]): ChatTransport {
  return {
    async *stream(_req: ChatStreamRequest): AsyncGenerator<ChatStreamEvent> {
      for (const e of events) yield e
    },
  }
}

// 挂载一个提供 useChatStream 的宿主组件；返回 handle 供断言
function mountStream(sessionId: Ref<string>, transport: ChatTransport): any {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [{ path: '/', component: { render: () => h('div') } }],
  })
  let handle: any
  mount(
    defineComponent({
      setup() {
        handle = useChatStream(sessionId, { transport })
        return () => h('div')
      },
    }),
    { global: { plugins: [router, [VueQueryPlugin, { queryClient: qc }]] } },
  )
  return handle
}

describe('useChatStream', () => {
  it('send appends user + assistant placeholder and accumulates deltas', async () => {
    const sessionId = ref('s1')
    const transport = fakeTransport([
      { type: 'step', data: { step: 'retrieval' } },
      { type: 'delta', data: { content: 'Hel' } },
      { type: 'delta', data: { content: 'lo' } },
      { type: 'done', data: { messageId: 'm1', usage: { promptTokens: 1, completionTokens: 2, totalTokens: 3 } } },
    ])
    const handle = mountStream(sessionId, transport)
    // 等待初始历史查询 settle（无后端 → 失败，不影响断言）
    await flush()
    await handle.send('hi')
    await flush()
    expect(handle.messages.value.map((m: any) => m.role)).toEqual(['user', 'assistant'])
    expect(handle.messages.value[1].content).toBe('Hello')
    expect(handle.phase.value).toBe('done')
  })

  it('sets phase=aborted when transport throws AbortError', async () => {
    const sessionId = ref('s1')
    const transport: ChatTransport = {
      async *stream(): AsyncGenerator<ChatStreamEvent> {
        yield { type: 'step', data: { step: 'retrieval' } }
        throw new DOMException('Aborted', 'AbortError')
      },
    }
    const handle = mountStream(sessionId, transport)
    await flush()
    await handle.send('hi')
    await flush()
    expect(handle.phase.value).toBe('aborted')
    expect(handle.messages.value[1].phase).toBe('aborted')
  })

  it('sets phase=error and error.value on non-abort transport error', async () => {
    const sessionId = ref('s1')
    const transport: ChatTransport = {
      async *stream(): AsyncGenerator<ChatStreamEvent> {
        yield { type: 'step', data: { step: 'retrieval' } }
        throw new Error('boom')
      },
    }
    const handle = mountStream(sessionId, transport)
    await flush()
    await handle.send('hi')
    await flush()
    expect(handle.phase.value).toBe('error')
    expect(handle.error.value).toBe('boom')
    expect(handle.messages.value[1].phase).toBe('error')
    expect(handle.messages.value[1].error).toBe('boom')
  })

  it('propagates citations to the streaming message', async () => {
    const sessionId = ref('s1')
    const citations = [{ documentName: 'doc.pdf', page: 1, score: 0.9 }]
    const transport = fakeTransport([
      { type: 'step', data: { step: 'retrieval' } },
      { type: 'citations', data: citations },
      { type: 'delta', data: { content: 'hi' } },
      { type: 'done', data: { messageId: 'm1', citations } },
    ])
    const handle = mountStream(sessionId, transport)
    await flush()
    await handle.send('hi')
    await flush()
    expect(handle.messages.value[1].citations).toEqual(citations)
  })
})
