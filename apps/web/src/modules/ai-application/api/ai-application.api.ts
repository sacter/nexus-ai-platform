import http from '@/api/client'
import type {
  AiApplication,
  CreateAiApplicationInput,
  UpdateAiApplicationInput,
} from '../types/ai-application'

/**
 * 路径为相对路径，由 client baseURL（/api/v1）自动拼接（与 model.api.ts 惯例一致）。
 * 后端控制器为单数 ai-application（@Controller('ai-application')），勿写成复数。
 */
export const aiApplicationsApi = {
  list: () => http.get<AiApplication[]>('/ai-application'),
  get: (id: string) => http.get<AiApplication>(`/ai-application/${id}`),
  create: (data: CreateAiApplicationInput) =>
    http.post<AiApplication>('/ai-application', data),
  update: (id: string, data: UpdateAiApplicationInput) =>
    http.patch<AiApplication>(`/ai-application/${id}`, data),
  delete: (id: string) => http.delete<{ id: string }>(`/ai-application/${id}`),
  bindTool: (id: string, toolId: string, config?: Record<string, unknown>) =>
    http.post<AiApplication>(`/ai-application/${id}/tools`, {
      toolId,
      ...(config ? { config } : {}),
    }),
  unbindTool: (id: string, toolId: string) =>
    http.delete<{ toolId: string }>(`/ai-application/${id}/tools/${toolId}`),
}
