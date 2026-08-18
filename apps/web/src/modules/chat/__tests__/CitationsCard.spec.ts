import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import CitationsCard from '../components/CitationsCard.vue'
import type { Citation } from '../types/chat'

const citations: Citation[] = [
  { documentName: 'a.pdf', page: 12, snippet: '片段 A', score: 0.92 },
  { documentName: 'b.pdf', page: 3, snippet: '片段 B', score: 0.85 },
]

describe('CitationsCard', () => {
  it('shows collapsed chip count and expands on click', async () => {
    const wrapper = mount(CitationsCard, { props: { citations } })
    expect(wrapper.text()).toContain('2 条来源')
    expect(wrapper.text()).not.toContain('a.pdf')
    await wrapper.find('[data-testid="citations-toggle"]').trigger('click')
    expect(wrapper.text()).toContain('a.pdf')
    expect(wrapper.text()).toContain('b.pdf')
  })

  it('renders nothing when citations empty', () => {
    const wrapper = mount(CitationsCard, { props: { citations: [] } })
    expect(wrapper.find('[data-testid="citations-toggle"]').exists()).toBe(false)
  })

  it('renders a citation with only documentName (no page/score/snippet)', async () => {
    const wrapper = mount(CitationsCard, { props: { citations: [{ documentName: 'only.pdf' }] } })
    await wrapper.find('[data-testid="citations-toggle"]').trigger('click')
    expect(wrapper.text()).toContain('only.pdf')
    // 无 score 时不渲染对应 span（条件分支覆盖）
    expect(wrapper.find('.num').exists()).toBe(false)
  })

  it('toggles aria-expanded with the list', async () => {
    const wrapper = mount(CitationsCard, { props: { citations } })
    const toggle = wrapper.find('[data-testid="citations-toggle"]')
    expect(toggle.attributes('aria-expanded')).toBe('false')
    await toggle.trigger('click')
    expect(toggle.attributes('aria-expanded')).toBe('true')
  })
})
