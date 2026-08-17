import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import ChatInput from '../components/ChatInput.vue'

describe('ChatInput', () => {
  it('emits send on Enter (no shift) and clears', async () => {
    const wrapper = mount(ChatInput)
    const textarea = wrapper.find('textarea')
    await textarea.setValue('hi')
    await textarea.trigger('keydown', { key: 'Enter' })
    expect(wrapper.emitted('send')?.[0]).toEqual(['hi'])
    expect((wrapper.find('textarea').element as HTMLTextAreaElement).value).toBe('')
  })

  it('does not emit send on Shift+Enter', async () => {
    const wrapper = mount(ChatInput)
    const textarea = wrapper.find('textarea')
    await textarea.setValue('hi')
    await textarea.trigger('keydown', { key: 'Enter', shiftKey: true })
    expect(wrapper.emitted('send')).toBeUndefined()
  })

  it('shows Stop button and emits stop when streaming', async () => {
    const wrapper = mount(ChatInput, { props: { streaming: true } })
    expect(wrapper.find('[data-testid="stop-btn"]').exists()).toBe(true)
    await wrapper.find('[data-testid="stop-btn"]').trigger('click')
    expect(wrapper.emitted('stop')).toBeTruthy()
  })
})
