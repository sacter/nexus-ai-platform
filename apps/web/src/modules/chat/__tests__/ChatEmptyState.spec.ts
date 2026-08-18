import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import ChatEmptyState from '../components/ChatEmptyState.vue'

describe('ChatEmptyState', () => {
  it('renders title and default suggestions', () => {
    const wrapper = mount(ChatEmptyState)
    expect(wrapper.text()).toContain('开始对话')
    expect(wrapper.text()).toContain('知识库问答')
    expect(wrapper.text()).toContain('起草文档')
    expect(wrapper.findAll('button').length).toBe(4)
  })

  it('emits suggest with suggestion text on card click', async () => {
    const wrapper = mount(ChatEmptyState, { props: { title: '开始一个新的对话' } })
    await wrapper.find('button').trigger('click')
    expect(wrapper.emitted('suggest')?.[0]).toEqual(['这个知识库包含哪些文档？'])
  })

  it('renders custom suggestions and emits their text', async () => {
    const custom = [
      { icon: {}, title: '自定义一', text: '第一条问题' },
      { icon: {}, title: '自定义二', text: '第二条问题' },
    ]
    const wrapper = mount(ChatEmptyState, { props: { suggestions: custom } })
    const cards = wrapper.findAll('button')
    expect(cards.length).toBe(2)
    await cards[1].trigger('click')
    expect(wrapper.emitted('suggest')?.[0]).toEqual(['第二条问题'])
  })
})
