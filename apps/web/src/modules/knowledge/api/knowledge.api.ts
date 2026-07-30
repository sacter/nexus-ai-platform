import http from '@/api/client'

export const knowledgeBasesApi = {
  list: (params?: Record<string, unknown>) => http.get('/knowledge-base', { params }),
  get: (id: string) => http.get(`/knowledge-base/${id}`),
  create: (data: unknown) => http.post('/knowledge-base', data),
  update: (id: string, data: unknown) => http.patch(`/knowledge-base/${id}`, data),
  delete: (id: string) => http.delete(`/knowledge-base/${id}`),
}
