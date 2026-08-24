/**
 * 提示词模板契约 —— 对齐后端 PromptTemplateService（Task 3.4）。
 * 模板 = 元信息 + 当前版本指针；正文/变量在版本上（变即打版本）。
 */

/** 模板版本（历史不可变；「当前」由模板的 currentVersionId 指针决定） */
export interface PromptTemplateVersion {
  id: string
  templateId: string
  versionNumber: number
  content: string
  /** 服务端从 content 抽取的 {{variables}} */
  variables: string[]
  isActive: boolean
  createdBy: string | null
  createdByName: string | null
  createdAt: string
}

/** 列表/详情行：模板 + 当前版本拍平 */
export interface PromptTemplateRow {
  id: string
  name: string
  description: string | null
  currentVersionId: string | null
  currentVersionNumber: number | null
  versionCount: number
  content: string | null
  variables: string[]
  createdAt: string
  updatedAt: string
}

/** 兼容既有消费方（AI 应用表单下拉仅需 id/name），保留旧名 */
export type PromptTemplate = PromptTemplateRow

export interface CreatePromptTemplateInput {
  name: string
  description?: string
  content: string
}

export interface UpdatePromptTemplateInput {
  name?: string
  description?: string
  content?: string
}
