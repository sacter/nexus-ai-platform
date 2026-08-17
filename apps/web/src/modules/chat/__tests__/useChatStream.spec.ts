import { describe, it, expect } from 'vitest'
import { defineComponent, h, ref } from 'vue'
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

describe('useChatStream', () => {
  it('send appends user + assistant placeholder and accumulates deltas', async () => {
    const sessionId = ref('s1')
    const transport = fakeTransport([
      { type: 'step', data: { step: 'retrieval' } },
      { type: 'delta', data: { content: 'Hel' } },
      { type: 'delta', data: { content: 'lo' } },
      { type: 'done', data: { messageId: 'm1', usage: { promptTokens: 1, completionTokens: 2, totalTokens: 3 } } },
    ])
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [{ path: '/', component: { render: () => h('div') } }],
    })
    let handle: any
    const Host = defineComponent({
      setup() {
        handle = useChatStream(sessionId, { transport })
        return () => h('div')
      },
    })
    mount(Host, { global: { plugins: [router, [VueQueryPlugin, { queryClient: qc }]] } })
    // 等待初始历史查询 settle（无后端 → 失败，不影响断言）
    await flush()
    await handle.send('hi')
    await flush()
    expect(handle.messages.value.map((m: any) => m.role)).toEqual(['user', 'assistant'])
    expect(handle.messages.value[1].content).toBe('Hello')
    expect(handle.phase.value).toBe('done')
  })
})
