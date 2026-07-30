import http from '@/api/client'

export const workflowsApi = {
  list: (params?: Record<string, unknown>) => http.get('/api/v1/workflows', { params }),
  get: (id: string) => http.get(`/api/v1/workflows/${id}`),
  create: (data: unknown) => http.post('/api/v1/workflows', data),
  update: (id: string, data: unknown) => http.patch(`/api/v1/workflows/${id}`, data),
  delete: (id: string) => http.delete(`/api/v1/workflows/${id}`),
  execute: (id: string, input?: unknown) => http.post(`/api/v1/workflows/${id}/execute`, input || {}),
}
