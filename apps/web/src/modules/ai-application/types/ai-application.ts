/**
 * AI 应用（ai_applications）前端类型 — 与 prisma/schema.prisma AiApplication
 * 及后端 AiApplicationService 返回的扁平化结构一致（camelCase）
 */

/** 应用状态（ai_applications.status）：active = 已发布 */
export type ApplicationStatus = 'active' | 'inactive' | 'draft'

export interface StatusMeta {
  value: string
  label: string
  tagType: 'success' | 'warning' | 'info'
}

export const APPLICATION_STATUS: StatusMeta[] = [
  { value: 'active', label: '已发布', tagType: 'success' },
  { value: 'draft', label: '草稿', tagType: 'warning' },
  { value: 'inactive', label: '已停用', tagType: 'info' },
]

export function statusMeta(status: string | undefined): StatusMeta {
  return (
    APPLICATION_STATUS.find((s) => s.value === status) ?? {
      value: status ?? '',
      label: status ?? '未知',
      tagType: 'info',
    }
  )
}

/** 运行配置（ai_applications.config JsonB，见 DATABASE.md 4.18） */
export interface AiApplicationConfig {
  temperature?: number
  maxTokens?: number
  welcomeMessage?: string
  suggestedQuestions?: string[]
}

/** 应用绑定的工具（junction 拍平一层，config 为应用级覆盖） */
export interface AiApplicationBoundTool {
  toolId: string
  name: string
  displayName: string
  type: string
  description: string | null
  config: unknown
}

/** 后端返回的应用（绑定资源名已扁平化：kbName/workflowName/...） */
export interface AiApplication {
  id: string
  name: string
  description: string | null
  icon: string
  knowledgeBaseId: string
  workflowId: string
  modelId: string
  promptTemplateId: string | null
  status: ApplicationStatus
  config: AiApplicationConfig
  createdBy: string
  createdAt: string
  updatedAt: string
  kbName: string
  workflowName: string
  workflowType: string
  modelDisplayName: string
  modelProvider: string
  promptTemplateName: string | null
  tools: AiApplicationBoundTool[]
}

export interface CreateAiApplicationInput {
  name: string
  description?: string
  icon?: string
  knowledgeBaseId: string
  workflowId: string
  modelId: string
  promptTemplateId?: string | null
  status?: ApplicationStatus
  config?: AiApplicationConfig
  toolIds?: string[]
}

export type UpdateAiApplicationInput = Partial<CreateAiApplicationInput>

/** 图标选项：icon 字段存 key，前端渲染为字形（默认 'bot'，与 DB 默认值一致） */
export const APP_ICONS = [
  { value: 'bot', glyph: '🤖', label: '机器人' },
  { value: 'sparkles', glyph: '✨', label: '灵感' },
  { value: 'brain', glyph: '🧠', label: '思考' },
  { value: 'finance', glyph: '📊', label: '财务' },
  { value: 'docs', glyph: '📄', label: '文档' },
  { value: 'support', glyph: '💁', label: '客服' },
  { value: 'code', glyph: '💻', label: '代码' },
  { value: 'search', glyph: '🔍', label: '检索' },
] as const

export function appIconGlyph(icon: string | undefined | null): string {
  return APP_ICONS.find((i) => i.value === icon)?.glyph ?? '🤖'
}
