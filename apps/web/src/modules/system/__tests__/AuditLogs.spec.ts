import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { defineComponent, ref, type Ref } from 'vue'
import ElementPlus from 'element-plus'
import AuditLogs from '../views/AuditLogs.vue'
import type { AuditLog, AuditLogListParams, AuditLogListResponse } from '../types/audit-log'

const logsData: Ref<AuditLogListResponse> = ref({ items: [], total: 0, page: 1, pageSize: 20 })
const isLoading = ref(false)
const isFetching = ref(false)
const isError = ref(false)
const refetch = vi.fn()
let capturedParams: Ref<AuditLogListParams> | null = null

vi.mock('@/modules/system/composables/useAuditLogs', () => ({
  useAuditLogs: (params: Ref<AuditLogListParams>) => {
    capturedParams = params
    return { data: logsData, isLoading, isFetching, isError, refetch }
  },
}))

vi.mock('@/modules/knowledge/api/knowledge.api', () => ({
  knowledgeBasesApi: { list: vi.fn().mockResolvedValue([]) },
}))

const ElSelectStub = defineComponent({
  name: 'ElSelect',
  props: { modelValue: { type: [String, Number, Array], default: '' } },
  emits: ['update:modelValue', 'change'],
  template: '<div class="el-select-stub"><slot /></div>',
})
const ElOptionStub = defineComponent({
  name: 'ElOption',
  props: { label: { type: [String, Number], default: '' }, value: { type: [String, Number], default: '' } },
  template: '<div class="el-option-stub" />',
})
const ElDatePickerStub = defineComponent({
  name: 'ElDatePicker',
  props: { modelValue: { type: [Array, String], default: null } },
  emits: ['update:modelValue', 'change'],
  template: '<div class="el-date-picker-stub" />',
})

function makeLog(overrides: Partial<AuditLog> = {}): AuditLog {
  return {
    id: 'log-1',
    userId: 'user-1',
    username: 'zhang',
    action: 'DOCUMENT_UPLOAD',
    entityType: 'document',
    entityId: 'doc-1',
    kbId: 'kb-1',
    kbName: 'HR 知识库',
    details: { fileName: '员工手册.pdf', version: 3 },
    ipAddress: '10.0.0.8',
    createdAt: '2026-08-24T10:30:00.000Z',
    ...overrides,
  }
}

function mountAuditLogs(data: AuditLogListResponse) {
  logsData.value = data
  return mount(AuditLogs, {
    global: {
      plugins: [ElementPlus],
      stubs: {
        teleport: true,
        ElSelect: ElSelectStub,
        ElOption: ElOptionStub,
        ElDatePicker: ElDatePickerStub,
      },
    },
  })
}

describe('AuditLogs', () => {
  beforeEach(() => {
    capturedParams = null
    refetch.mockClear()
  })

  it('sends paginated params and omits empty filters', () => {
    mountAuditLogs({ items: [], total: 0, page: 1, pageSize: 20 })
    const params = capturedParams!.value
    expect(params.page).toBe(1)
    expect(params.pageSize).toBe(20)
    expect(params.keyword).toBeUndefined()
    expect(params.action).toBeUndefined()
  })

  it('resets to the first page when the keyword filter changes', async () => {
    const wrapper = mountAuditLogs({ items: [makeLog()], total: 1, page: 1, pageSize: 20 })
    await wrapper.find('[data-test="keyword-filter"] input').setValue('zhang')
    expect(capturedParams!.value.page).toBe(1)
    expect(capturedParams!.value.keyword).toBe('zhang')
  })

  it('converts date range into day-boundary ISO params', async () => {
    const wrapper = mountAuditLogs({ items: [], total: 0, page: 1, pageSize: 20 })
    wrapper.findComponent({ name: 'ElDatePicker' }).vm.$emit('update:modelValue', ['2026-08-01', '2026-08-03'])
    await flushPromises()
    expect(capturedParams!.value.startDate).toBe('2026-08-01T00:00:00.000Z')
    expect(capturedParams!.value.endDate).toBe('2026-08-03T23:59:59.999Z')
  })

  it('shows an actionable empty state when filters match nothing', () => {
    const wrapper = mountAuditLogs({ items: [], total: 0, page: 1, pageSize: 20 })
    expect(wrapper.text()).toContain('暂无审计记录')
  })

  it('offers reset from the filtered empty state', async () => {
    const wrapper = mountAuditLogs({ items: [], total: 0, page: 1, pageSize: 20 })
    await wrapper.find('[data-test="keyword-filter"] input').setValue('missing')
    expect(wrapper.text()).toContain('没有匹配的审计记录')
    const reset = wrapper.find('[data-test="reset-filters"]')
    expect(reset.exists()).toBe(true)
    await reset.trigger('click')
    expect(capturedParams!.value.keyword).toBeUndefined()
  })

  it('renders action labels and opens the detail drawer for a selected log', async () => {
    const wrapper = mountAuditLogs({ items: [makeLog()], total: 1, page: 1, pageSize: 20 })
    expect(wrapper.text()).toContain('上传文档')
    await wrapper.findAll('[data-test="view-log"]')[0].trigger('click')
    await flushPromises()
    expect(wrapper.text()).toContain('日志详情')
    expect(wrapper.text()).toContain('员工手册.pdf')
    expect(wrapper.text()).toContain('10.0.0.8')
  })

  it('labels icon-only controls accessibly', () => {
    const wrapper = mountAuditLogs({ items: [], total: 0, page: 1, pageSize: 20 })
    expect(wrapper.find('[aria-label="刷新审计日志"]').exists()).toBe(true)
  })

  it('shows an error alert with a retry action when the query fails', async () => {
    isError.value = true
    const wrapper = mountAuditLogs({ items: [], total: 0, page: 1, pageSize: 20 })
    expect(wrapper.text()).toContain('审计日志加载失败')
    await wrapper.find('[data-test="retry-load"]').trigger('click')
    expect(refetch).toHaveBeenCalled()
    isError.value = false
  })
})
