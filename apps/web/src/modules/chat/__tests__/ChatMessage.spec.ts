import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import ChatMessage from '../components/ChatMessage.vue'
import type { ChatMessage as ChatMessageType } from '../types/chat'

const base: ChatMessageType = {
  tempId: 't1', sessionId: 's1', role: 'assistant',
  content: '# Title\n\nsome **bold**', citations: [], streaming: false, phase: 'done',
}

describe('ChatMessage', () => {
  it('renders markdown for assistant', () => {
    const wrapper = mount(ChatMessage, { props: { message: base } })
    expect(wrapper.html()).toContain('<h1>Title</h1>')
    expect(wrapper.html()).toContain('<strong>bold</strong>')
  })

  it('renders plain text for user', () => {
    const wrapper = mount(ChatMessage, { props: { message: { ...base, role: 'user', content: '<b>not html</b>' } } })
    expect(wrapper.html()).not.toContain('<b>not html</b>')
    expect(wrapper.text()).toContain('<b>not html</b>')
  })

  it('shows streaming cursor when streaming', () => {
    const wrapper = mount(ChatMessage, { props: { message: { ...base, streaming: true, content: 'partial' } } })
    expect(wrapper.find('[data-testid="stream-cursor"]').exists()).toBe(true)
  })

  it('emits feedback action on click', async () => {
    const wrapper = mount(ChatMessage, { props: { message: { ...base, id: 'm1' } } })
    await wrapper.find('[data-testid="feedback-like"]').trigger('click')
    expect(wrapper.emitted('feedback')?.[0]).toEqual(['m1', 'like'])
  })

  it('renders citations card when citations present', () => {
    const wrapper = mount(ChatMessage, {
      props: { message: { ...base, citations: [{ documentName: 'a.pdf', page: 1, score: 0.9 }] } },
    })
    expect(wrapper.text()).toContain('1 条来源')
  })

  it('does not render token footer when only totalTokens is set (no undefined)', () => {
    // showTokens 守卫三个字段；仅 totalTokens 时整段不渲染，避免 undefined/undefined/123
    const wrapper = mount(ChatMessage, { props: { message: { ...base, totalTokens: 123 } } })
    expect(wrapper.html()).not.toContain('undefined')
  })

  it('renders token footer when all token fields set', () => {
    const wrapper = mount(ChatMessage, {
      props: { message: { ...base, promptTokens: 1, completionTokens: 2, totalTokens: 3 } },
    })
    expect(wrapper.html()).toContain('1/2/3')
  })

  it('emits dislike on dislike-button click', async () => {
    const wrapper = mount(ChatMessage, { props: { message: { ...base, id: 'm1' } } })
    await wrapper.find('[data-testid="feedback-dislike"]').trigger('click')
    expect(wrapper.emitted('feedback')?.[0]).toEqual(['m1', 'dislike'])
  })

  it('strips script tags from assistant markdown (XSS contract)', () => {
    const wrapper = mount(ChatMessage, {
      props: { message: { ...base, content: '<script>alert(1)</script>text' } },
    })
    expect(wrapper.html()).not.toContain('<script')
  })

  it('opens markdown links in a new tab (spec §4.1 链接新标签)', () => {
    const wrapper = mount(ChatMessage, {
      props: { message: { ...base, content: '[docs](https://example.com)' } },
    })
    const a = wrapper.find('a')
    expect(a.exists()).toBe(true)
    expect(a.attributes('target')).toBe('_blank')
    expect(a.attributes('rel')).toBe('noopener noreferrer')
  })
})
