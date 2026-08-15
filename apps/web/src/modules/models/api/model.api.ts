import http from '@/api/client'
import type { Model, ModelCreateInput, ModelUpdateInput } from '@/modules/models/types/model'

export const modelsApi = {
  list: (params?: Record<string, unknown>) => http.get<Model[]>('/api/v1/models', { params }),
  get: (id: string) => http.get<Model>(`/api/v1/models/${id}`),
  create: (data: ModelCreateInput) => http.post<Model>('/api/v1/models', data),
  update: (id: string, data: ModelUpdateInput) => http.patch<Model>(`/api/v1/models/${id}`, data),
  delete: (id: string) => http.delete<{ id: string }>(`/api/v1/models/${id}`),
}
