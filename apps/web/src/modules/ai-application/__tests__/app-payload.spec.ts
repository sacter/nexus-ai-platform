import { describe, expect, it } from 'vitest'
import {
  buildAppPayload,
  emptyAppForm,
  formFromApp,
} from '../utils/app-payload'
import {
  appIconGlyph,
  statusMeta,
  type AiApplication,
} from '../types/ai-application'

function baseForm() {
  return {
    ...emptyAppForm(),
    name: '  财务助手  ',
    knowledgeBaseId: 'kb-1',
    workflowId: 'wf-1',
    modelId: 'model-1',
  }
}

describe('buildAppPayload', () => {
  it('trim 名称/描述，空字段不落库', () => {
    const payload = buildAppPayload(baseForm())

    expect(payload.name).toBe('财务助手')
    expect(payload.description).toBeUndefined()
    expect(payload.promptTemplateId).toBeNull()
    expect(payload.config).toEqual({ temperature: 0.7, maxTokens: 4096 })
    expect(payload.toolIds).toEqual([])
  })

  it('welcomeMessage / suggestedQuestions 仅在有内容时进入 config，且逐条 trim', () => {
    const form = {
      ...baseForm(),
      welcomeMessage: '  你好！ ',
      suggestedQuestions: [' 报销流程？ ', '   ', '请假流程？'],
      promptTemplateId: 'prompt-1',
      toolIds: ['t-1', 't-1', 't-2'],
    }
    const payload = buildAppPayload(form)

    expect(payload.config?.welcomeMessage).toBe('你好！')
    expect(payload.config?.suggestedQuestions).toEqual(['报销流程？', '请假流程？'])
    expect(payload.promptTemplateId).toBe('prompt-1')
    expect(payload.toolIds).toEqual(['t-1', 't-2'])
  })

  it('icon 为空时回退 bot（与 DB 默认值一致）', () => {
    const payload = buildAppPayload({ ...baseForm(), icon: '' })
    expect(payload.icon).toBe('bot')
  })
})

describe('formFromApp', () => {
  it('详情 → 表单回填，config 缺省值补默认', () => {
    const app = {
      id: 'app-1',
      name: '财务助手',
      description: null,
      icon: 'finance',
      knowledgeBaseId: 'kb-1',
      workflowId: 'wf-1',
      modelId: 'model-1',
      promptTemplateId: null,
      status: 'draft',
      config: {},
      createdBy: 'user-1',
      createdAt: '',
      updatedAt: '',
      kbName: '财务制度库',
      workflowName: 'RAG',
      workflowType: 'rag',
      modelDisplayName: 'DeepSeek Chat',
      modelProvider: 'deepseek',
      promptTemplateName: null,
      tools: [{ toolId: 't-1' }, { toolId: 't-2' }],
    } as unknown as AiApplication

    const form = formFromApp(app)

    expect(form.description).toBe('')
    expect(form.temperature).toBe(0.7)
    expect(form.maxTokens).toBe(4096)
    expect(form.suggestedQuestions).toEqual([])
    expect(form.toolIds).toEqual(['t-1', 't-2'])
    expect(form.promptTemplateId).toBe('')
  })
})

describe('statusMeta / appIconGlyph', () => {
  it('已知状态返回中文标签，未知状态兜底 info', () => {
    expect(statusMeta('active').label).toBe('已发布')
    expect(statusMeta('draft').tagType).toBe('warning')
    expect(statusMeta('archived').tagType).toBe('info')
  })

  it('已知图标返回字形，未知图标回退 🤖', () => {
    expect(appIconGlyph('finance')).toBe('📊')
    expect(appIconGlyph('unknown')).toBe('🤖')
    expect(appIconGlyph(undefined)).toBe('🤖')
  })
})
