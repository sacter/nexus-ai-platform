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
})
