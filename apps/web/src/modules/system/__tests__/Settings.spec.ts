import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { ref, type Ref } from 'vue'
import ElementPlus from 'element-plus'
import Settings from '../views/Settings.vue'
import type { Settings as SettingsConfig } from '../types/settings'

const { get, update } = vi.hoisted(() => ({ get: vi.fn(), update: vi.fn() }))

const config: Ref<SettingsConfig> = ref({
  embedding: { provider: 'openai', model: 'text-embedding-3-small', dimension: 1536 },
  chunk: { size: 1000, overlap: 200 },
  retrieval: { topK: 20, similarityThreshold: 0.7, strategy: 'vector' },
  rerank: { enabled: false, topN: 20, rerankTopK: 5, model: 'bge-reranker-v2-m3' },
  queryRewrite: { enabled: false, count: 3 },
  system: { maxFileSize: 52428800, allowedTypes: ['application/pdf'] },
})

vi.mock('@/modules/system/api/settings.api', () => ({
  settingsApi: { get, update },
}))

function mountSettings() {
  return mount(Settings, { global: { plugins: [ElementPlus] } })
}

describe('Settings', () => {
  beforeEach(() => {
    get.mockReset().mockResolvedValue(config.value)
    update.mockReset().mockImplementation((data: SettingsConfig) => Promise.resolve(data))
  })

  it('loads configuration and exposes the settings sections', async () => {
    const wrapper = mountSettings()
    await flushPromises()
    expect(get).toHaveBeenCalled()
    expect(wrapper.text()).toContain('检索策略')
    expect(wrapper.text()).toContain('向量模型')
    expect(wrapper.text()).toContain('文件接入')
    expect(wrapper.text()).toContain('text-embedding-3-small')
  })

  it('saves a changed retrieval strategy through the settings contract', async () => {
    const wrapper = mountSettings()
    await flushPromises()
    await wrapper.find('.strategy-options .el-radio-button:last-child input').setValue(true)
    expect(wrapper.find('[data-test="save-status"]').text()).toContain('有未保存更改')
    // 表单 validate 为异步微任务，确保规则校验完成后再点击保存
    await wrapper.vm.$nextTick()
    await wrapper.find('[data-test="save-settings"]').trigger('click')
    await flushPromises()
    expect(update).toHaveBeenCalledWith(expect.objectContaining({ retrieval: expect.objectContaining({ strategy: 'hybrid' }) }))
    expect(wrapper.find('[data-test="save-status"]').text()).toContain('已保存')
  })

  it('restores defaults without saving immediately', async () => {
    const wrapper = mountSettings()
    await flushPromises()
    await wrapper.find('.strategy-options .el-radio-button:last-child input').setValue(true)
    await wrapper.find('[data-test="restore-defaults"]').trigger('click')
    await flushPromises()
    expect(update).not.toHaveBeenCalled()
    expect(document.body.textContent).toContain('已恢复推荐配置')
  })
})
