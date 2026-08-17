import { describe, it, expect } from 'vitest'
import { applyStreamEvent, type ReduceState } from '../composables/chat-stream-reducer'
import type { ChatMessage } from '../types/chat'

function base(): ReduceState {
  const message: ChatMessage = {
    tempId: 't1', sessionId: 's1', role: 'assistant',
    content: '', streaming: true, phase: 'retrieving', citations: [],
  }
  return { message, phase: 'retrieving' }
}

describe('applyStreamEvent', () => {
  it('step event transitions phase', () => {
    const s = applyStreamEvent(base(), { type: 'step', data: { step: 'generating' } })
    expect(s.phase).toBe('generating')
    expect(s.message.phase).toBe('generating')
  })

  it('citations event attaches citations', () => {
    const s = applyStreamEvent(base(), { type: 'citations', data: [{ documentName: 'a.pdf', page: 1, score: 0.9 }] })
    expect(s.message.citations).toHaveLength(1)
    expect(s.message.citations![0].documentName).toBe('a.pdf')
  })

  it('delta event appends content and sets generating', () => {
    let s = applyStreamEvent(base(), { type: 'delta', data: { content: 'Hello' } })
    s = applyStreamEvent(s, { type: 'delta', data: { content: ' world' } })
    expect(s.message.content).toBe('Hello world')
    expect(s.phase).toBe('generating')
  })

  it('done event finalizes with id and usage', () => {
    const s = applyStreamEvent(base(), {
      type: 'done',
      data: { messageId: 'm1', usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 } },
    })
    expect(s.phase).toBe('done')
    expect(s.message.streaming).toBe(false)
    expect(s.message.id).toBe('m1')
    expect(s.message.totalTokens).toBe(15)
  })

  it('error event sets error state', () => {
    const s = applyStreamEvent(base(), { type: 'error', data: { message: 'boom' } })
    expect(s.phase).toBe('error')
    expect(s.message.streaming).toBe(false)
    expect(s.message.error).toBe('boom')
  })

  it('does not mutate the input state', () => {
    const before = base()
    applyStreamEvent(before, { type: 'delta', data: { content: 'x' } })
    expect(before.message.content).toBe('')
    expect(before.phase).toBe('retrieving')
  })
})
