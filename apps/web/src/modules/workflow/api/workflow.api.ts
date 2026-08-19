import http from '@/api/client'

export const workflowsApi = {
  list: (params?: Record<string, unknown>) => http.get('/workflows', { params }),
  get: (id: string) => http.get(`/workflows/${id}`),
  create: (data: unknown) => http.post('/workflows', data),
  update: (id: string, data: unknown) => http.patch(`/workflows/${id}`, data),
  delete: (id: string) => http.delete(`/workflows/${id}`),
  execute: (id: string, input?: unknown) => http.post(`/workflows/${id}/execute`, input || {}),
}
