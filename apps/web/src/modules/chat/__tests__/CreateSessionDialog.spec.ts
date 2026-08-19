import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises, type VueWrapper } from '@vue/test-utils'
import { defineComponent, ref } from 'vue'
import ElementPlus, { ElMessage } from 'element-plus'
import { VueQueryPlugin, QueryClient } from '@tanstack/vue-query'
import CreateSessionDialog from '../components/CreateSessionDialog.vue'

// ElSelect 在 jsdom 下配合异步 options 会触发 "Maximum recursive updates exceeded"
// （其内部 watch(() => states.options.entries()) → setSelected 循环不收敛），
// 进而中断 ElDialog 初始渲染。这里用最小桩件替换 ElSelect/ElOption，
// 仅保留断言依赖的 modelValue/disabled props 与 update:modelValue 事件转发，
// 不改变被测组件（CreateSessionDialog）的响应式行为。
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
// ElForm 在当前 jsdom + VTU + Element Plus 2.14 组合下，ElFormItem 不会向 ElForm
// 注册（fields 数组恒空），导致 formRef.validate() 永远 resolve(true)——即便标题为空
// 也不拒绝。这是 EP 内部 provide/inject 注册在此环境下的兼容性问题，非被测组件问题。
// 这里用最小桩件替换 ElForm：暴露 validate()（标题为空时 reject、否则 resolve(true)）
// 与 clearValidate()，并在校验失败时渲染 .el-form-item__error，使被测组件的
// handleSubmit 校验短路逻辑与错误展示可被断言覆盖。
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

function mountDialog(props: Record<string, unknown> = {}) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return mount(CreateSessionDialog, {
    props: { visible: true, ...props },
    global: {
      plugins: [ElementPlus, [VueQueryPlugin, { queryClient: qc }]],
      // el-dialog 默认 teleport 到 body；stub 掉让内容渲染在 wrapper 内，便于查询
      // ElSelect/ElOption/ElForm 见上方说明：jsdom 下 EP 组件兼容性问题，桩件替换
      stubs: { teleport: true, ElForm: ElFormStub, ElSelect: ElSelectStub, ElOption: ElOptionStub },
    },
  })
}

// el-select 顺序：0=AI 应用 1=知识库 2=提示词 3=工作流
async function selectValue(wrapper: VueWrapper, index: number, value: string) {
  const selects = wrapper.findAllComponents({ name: 'ElSelect' })
  selects[index].vm.$emit('update:modelValue', value)
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
  })

  it('仅填标题即可创建，workflowType 默认 rag', async () => {
    const wrapper = mountDialog()
    await flushPromises()
    await wrapper.find('input').setValue('我的会话')
    await submit(wrapper)
    expect(createSession).toHaveBeenCalledWith({ title: '我的会话', workflowType: 'rag' })
    expect(wrapper.emitted('created')?.[0]?.[0]).toMatchObject({ id: 's-1', title: 'x' })
  })

  it('选择工作流后带 workflowId 与该工作流的 type', async () => {
    const wrapper = mountDialog()
    await flushPromises()
    await wrapper.find('input').setValue('流程会话')
    await selectValue(wrapper, 3, 'wf-1')
    await submit(wrapper)
    expect(createSession).toHaveBeenCalledWith({
      title: '流程会话',
      workflowId: 'wf-1',
      workflowType: 'rewoo',
    })
  })

  it('选择 AI 应用后清空并禁用知识库/提示词/工作流，payload 只带 aiApplicationId', async () => {
    const wrapper = mountDialog()
    await flushPromises()
    await wrapper.find('input').setValue('应用会话')
    await selectValue(wrapper, 1, 'kb-1')
    await selectValue(wrapper, 3, 'wf-1')
    await selectValue(wrapper, 0, 'app-1')
    const selects = wrapper.findAllComponents({ name: 'ElSelect' })
    expect(selects[1].props('modelValue')).toBe('')
    expect(selects[1].props('disabled')).toBe(true)
    expect(selects[2].props('disabled')).toBe(true)
    expect(selects[3].props('disabled')).toBe(true)
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

  it('选项源加载失败显示错误提示，且不阻塞仅标题创建', async () => {
    kbList.mockRejectedValue(new Error('boom'))
    const wrapper = mountDialog()
    await flushPromises()
    expect(wrapper.text()).toContain('加载失败')
    await wrapper.find('input').setValue('容错会话')
    await submit(wrapper)
    expect(createSession).toHaveBeenCalledWith({ title: '容错会话', workflowType: 'rag' })
  })

  it('提交失败时弹窗保持打开、表单内容保留并提示错误', async () => {
    createSession.mockRejectedValue(new Error('boom'))
    // ElMessage.error 在 jsdom 下会尝试挂载消息组件到 body，mock 掉避免副作用并便于断言
    const errorSpy = vi.spyOn(ElMessage, 'error').mockImplementation(() => ({}) as never)
    const wrapper = mountDialog()
    await flushPromises()
    await wrapper.find('input').setValue('失败会话')
    await submit(wrapper)
    expect(createSession).toHaveBeenCalledTimes(1)
    // 弹窗保持打开：组件未发出 update:visible(false)
    const visibleEmits = wrapper.emitted('update:visible')
    const closed = visibleEmits?.some((payload) => payload[0] === false) ?? false
    expect(closed).toBe(false)
    // 表单内容保留
    expect((wrapper.find('input').element as HTMLInputElement).value).toBe('失败会话')
    // 错误提示
    expect(errorSpy).toHaveBeenCalledWith('创建会话失败')
    errorSpy.mockRestore()
  })
})
