import type {
  AiApplication,
  AiApplicationConfig,
  CreateAiApplicationInput,
} from '../types/ai-application'

/** AppForm 的表单状态（视图与提交 payload 之间的纯数据层） */
export interface AppFormState {
  name: string
  description: string
  icon: string
  knowledgeBaseId: string
  workflowId: string
  modelId: string
  promptTemplateId: string
  temperature: number
  maxTokens: number
  welcomeMessage: string
  suggestedQuestions: string[]
  toolIds: string[]
}

export function emptyAppForm(): AppFormState {
  return {
    name: '',
    description: '',
    icon: 'bot',
    knowledgeBaseId: '',
    workflowId: '',
    modelId: '',
    promptTemplateId: '',
    temperature: 0.7,
    maxTokens: 4096,
    welcomeMessage: '',
    suggestedQuestions: [],
    toolIds: [],
  }
}

/** 详情 → 表单（编辑模式回填） */
export function formFromApp(app: AiApplication): AppFormState {
  const config = app.config ?? {}
  return {
    name: app.name,
    description: app.description ?? '',
    icon: app.icon || 'bot',
    knowledgeBaseId: app.knowledgeBaseId,
    workflowId: app.workflowId,
    modelId: app.modelId,
    promptTemplateId: app.promptTemplateId ?? '',
    temperature: config.temperature ?? 0.7,
    maxTokens: config.maxTokens ?? 4096,
    welcomeMessage: config.welcomeMessage ?? '',
    suggestedQuestions: [...(config.suggestedQuestions ?? [])],
    toolIds: app.tools.map((t) => t.toolId),
  }
}

/**
 * 表单 → 提交 payload：trim 文案、空值不落库
 * （promptTemplateId 空串 → null = 使用系统默认；toolIds 始终提交，编辑时为空 = 清空绑定）
 */
export function buildAppPayload(form: AppFormState): CreateAiApplicationInput {
  const config: AiApplicationConfig = {
    temperature: form.temperature,
    maxTokens: form.maxTokens,
  }
  const welcomeMessage = form.welcomeMessage.trim()
  if (welcomeMessage) config.welcomeMessage = welcomeMessage
  const suggestedQuestions = form.suggestedQuestions
    .map((q) => q.trim())
    .filter(Boolean)
  if (suggestedQuestions.length) config.suggestedQuestions = suggestedQuestions

  const description = form.description.trim()
  return {
    name: form.name.trim(),
    ...(description ? { description } : {}),
    icon: form.icon || 'bot',
    knowledgeBaseId: form.knowledgeBaseId,
    workflowId: form.workflowId,
    modelId: form.modelId,
    promptTemplateId: form.promptTemplateId || null,
    config,
    toolIds: [...new Set(form.toolIds)],
  }
}
