import http from '@/api/client'
import type {
  CreatePromptTemplateInput,
  PromptTemplateRow,
  PromptTemplateVersion,
  UpdatePromptTemplateInput,
} from '../types/prompt'

/** 后端控制器为复数 prompt-templates（PromptTemplateModule）；相对路径，勿加 /api/v1 前缀 */
export const promptsApi = {
  list: () => http.get<PromptTemplateRow[]>('/prompt-templates'),
  get: (id: string) => http.get<PromptTemplateRow>(`/prompt-templates/${id}`),
  listVersions: (id: string) =>
    http.get<PromptTemplateVersion[]>(`/prompt-templates/${id}/versions`),
  create: (data: CreatePromptTemplateInput) =>
    http.post<PromptTemplateRow>('/prompt-templates', data),
  /** 正文变更 ⇒ 后端自动创建新版本；正文不变 ⇒ 仅更新元信息 */
  update: (id: string, data: UpdatePromptTemplateInput) =>
    http.patch<PromptTemplateRow>(`/prompt-templates/${id}`, data),
  delete: (id: string) =>
    http.delete<{ id: string; deleted: boolean }>(`/prompt-templates/${id}`),
}
