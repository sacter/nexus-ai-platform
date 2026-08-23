import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises, type VueWrapper } from '@vue/test-utils'
import { defineComponent, ref } from 'vue'
import ElementPlus, { ElMessage } from 'element-plus'
import { VueQueryPlugin, QueryClient } from '@tanstack/vue-query'
import CreateSessionDialog from '../components/CreateSessionDialog.vue'

// ElSelect/ElOption/ElForm 在 jsdom + EP 2.14 下的兼容性桩件（理由见原文件注释，保持不变）
const ElSelectStub = defineComponent({
  name: 'ElSelect',
  props: {
    modelValue: { type: [String, Number, Boolean, Array], default: '' },
    disabled: { type: Boolean, default: false },
    clearable: { type: Boolean, default: false },
    filterable: { type: Boolean, default: false },
    placeholder: { type: String, default: '' },
    multiple: { type: Boolean, default: false },
  },
  emits: ['update:modelValue', 'change'],
  template: '<div class="el-select-stub"><slot /></div>',
})
const ElOptionStub = defineComponent({
  name: 'ElOption',
  props: {
    label: { type: [String, Number], default: '' },
    value: { type: [String, Number, Boolean, Object], default: '' },
  },
  template: '<div class="el-option-stub" />',
})
const ElFormStub = defineComponent({
  name: 'ElForm',
  props: {
    model: { type: Object, default: () => ({}) },
    rules: { type: Object, default: () => ({}) },
  },
  setup(props, { expose }) {
    const errorMessage = ref('')
    function validate() {
      const title = String(props.model?.title ?? '').trim()
      if (!title) {
        errorMessage.value = '请输入会话标题'
        return Promise.reject(new Error('validation failed'))
      }
      errorMessage.value = ''
      return Promise.resolve(true)
    }
    function clearValidate() {
      errorMessage.value = ''
    }
    expose({ validate, clearValidate })
    return { errorMessage }
  },
  template: '<div class="el-form"><slot /><div v-if="errorMessage" class="el-form-item__error">{{ errorMessage }}</div></div>',
})

const createSession = vi.fn()
const kbList = vi.fn()
const promptList = vi.fn()
const appList = vi.fn()
const workflowList = vi.fn()
const modelList = vi.fn()
const toolList = vi.fn()

vi.mock('@/modules/chat/api/chat.api', () => ({
  chatApi: { createSession: (...args: unknown[]) => createSession(...args) },
}))
vi.mock('@/modules/knowledge/api/knowledge.api', () => ({
  knowledgeBasesApi: { list: (...args: unknown[]) => kbList(...args) },
}))
vi.mock('@/modules/prompt/api/prompt.api', () => ({
  promptsApi: { list: (...args: unknown[]) => promptList(...args) },
}))
vi.mock('@/modules/ai-application/api/ai-application.api', () => ({
  aiApplicationsApi: { list: (...args: unknown[]) => appList(...args) },
}))
vi.mock('@/modules/workflow/api/workflow.api', () => ({
  workflowsApi: { list: (...args: unknown[]) => workflowList(...args) },
}))
vi.mock('@/modules/models/api/model.api', () => ({
  modelsApi: { list: (...args: unknown[]) => modelList(...args) },
}))
vi.mock('@/modules/tools/api/tool.api', () => ({
  toolsApi: { list: (...args: unknown[]) => toolList(...args) },
}))

function mountDialog(props: Record<string, unknown> = {}) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return mount(CreateSessionDialog, {
    props: { visible: true, ...props },
    global: {
      plugins: [ElementPlus, [VueQueryPlugin, { queryClient: qc }]],
      stubs: { teleport: true, ElForm: ElFormStub, ElSelect: ElSelectStub, ElOption: ElOptionStub },
    },
  })
}

async function setTitle(wrapper: VueWrapper, text: string) {
  await wrapper.find('input').setValue(text)
}

// 自定义模式（默认）下 el-select 顺序：0=知识库 1=提示词 2=工作流 3=模型 4=工具
// 快捷模式下顺序：0=AI 应用
async function selectValue(wrapper: VueWrapper, index: number, value: string | string[]) {
  const selects = wrapper.findAllComponents({ name: 'ElSelect' })
  selects[index].vm.$emit('update:modelValue', value)
  await flushPromises()
}

async function switchMode(wrapper: VueWrapper, mode: 'quick' | 'custom') {
  const radio = wrapper.find(`input[type="radio"][value="${mode}"]`)
  await radio.setValue(true)
  await flushPromises()
}

async function submit(wrapper: VueWrapper) {
  await wrapper.find('[data-testid="create-session-submit"]').trigger('click')
  await flushPromises()
}

describe('CreateSessionDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    createSession.mockResolvedValue({ id: 's-1', title: 'x' })
    kbList.mockResolvedValue([{ id: 'kb-1', name: '默认知识库' }])
    promptList.mockResolvedValue([{ id: 'pt-1', name: '默认提示词' }])
    appList.mockResolvedValue([{ id: 'app-1', name: '客服助手' }])
    workflowList.mockResolvedValue([{ id: 'wf-1', name: 'ReWOO 流程', type: 'rewoo' }])
    modelList.mockResolvedValue([
      { id: 'model-1', displayName: 'DeepSeek', type: 'chat' },
      { id: 'model-2', displayName: 'BGE', type: 'embedding' },
    ])
    toolList.mockResolvedValue([{ id: 'tool-1' }, { id: 'tool-2' }])
  })

  it('自定义模式（默认）：仅填标题即可创建，workflowType 默认 rag', async () => {
    const wrapper = mountDialog()
    await flushPromises()
    await setTitle(wrapper, '我的会话')
    await submit(wrapper)
    expect(createSession).toHaveBeenCalledWith({ title: '我的会话', workflowType: 'rag' })
    expect(wrapper.emitted('created')?.[0]?.[0]).toMatchObject({ id: 's-1', title: 'x' })
  })

  it('自定义模式：选模型与工具后 payload 带 modelId 与 toolIds', async () => {
    const wrapper = mountDialog()
    await flushPromises()
    await setTitle(wrapper, '带模型会话')
    await selectValue(wrapper, 3, 'model-1')
    await selectValue(wrapper, 4, ['tool-1', 'tool-2'])
    await submit(wrapper)
    expect(createSession).toHaveBeenCalledWith({
      title: '带模型会话',
      modelId: 'model-1',
      toolIds: ['tool-1', 'tool-2'],
      workflowType: 'rag',
    })
  })

  it('自定义模式：选工作流后带 workflowId 与该工作流的 type', async () => {
    const wrapper = mountDialog()
    await flushPromises()
    await setTitle(wrapper, '流程会话')
    await selectValue(wrapper, 2, 'wf-1')
    await submit(wrapper)
    expect(createSession).toHaveBeenCalledWith({
      title: '流程会话',
      workflowId: 'wf-1',
      workflowType: 'rewoo',
    })
  })

  it('快捷模式：选 AI 应用后 payload 只带 aiApplicationId', async () => {
    const wrapper = mountDialog()
    await flushPromises()
    await switchMode(wrapper, 'quick')
    await setTitle(wrapper, '应用会话')
    await selectValue(wrapper, 0, 'app-1')
    await submit(wrapper)
    expect(createSession).toHaveBeenCalledWith({
      title: '应用会话',
      aiApplicationId: 'app-1',
      workflowType: 'rag',
    })
  })

  it('标题为空时校验失败，不提交', async () => {
    const wrapper = mountDialog()
    await flushPromises()
    await submit(wrapper)
    expect(createSession).not.toHaveBeenCalled()
    expect(wrapper.find('.el-form-item__error').exists()).toBe(true)
  })

  it('prefillTitle 预填标题', async () => {
    const wrapper = mountDialog({ prefillTitle: '知识库问答' })
    await flushPromises()
    expect((wrapper.find('input').element as HTMLInputElement).value).toBe('知识库问答')
  })

  it('提交失败时弹窗保持打开、表单内容保留并提示错误', async () => {
    createSession.mockRejectedValue(new Error('boom'))
    const errorSpy = vi.spyOn(ElMessage, 'error').mockImplementation(() => ({}) as never)
    const wrapper = mountDialog()
    await flushPromises()
    await setTitle(wrapper, '失败会话')
    await submit(wrapper)
    expect(createSession).toHaveBeenCalledTimes(1)
    const visibleEmits = wrapper.emitted('update:visible')
    const closed = visibleEmits?.some((payload) => payload[0] === false) ?? false
    expect(closed).toBe(false)
    expect((wrapper.find('input').element as HTMLInputElement).value).toBe('失败会话')
    expect(errorSpy).toHaveBeenCalledWith('创建会话失败')
    errorSpy.mockRestore()
  })
})
