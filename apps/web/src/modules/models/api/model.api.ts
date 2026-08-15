import http from '@/api/client'
import type { Model, ModelCreateInput, ModelUpdateInput } from '@/modules/models/types/model'

/** 路径为相对路径，由 client baseURL（/api/v1）自动拼接，与 api-keys 模块惯例一致 */
export const modelsApi = {
  list: (params?: Record<string, unknown>) => http.get<Model[]>('/models', { params }),
  get: (id: string) => http.get<Model>(`/models/${id}`),
  create: (data: ModelCreateInput) => http.post<Model>('/models', data),
  update: (id: string, data: ModelUpdateInput) => http.patch<Model>(`/models/${id}`, data),
  delete: (id: string) => http.delete<{ id: string }>(`/models/${id}`),
}
