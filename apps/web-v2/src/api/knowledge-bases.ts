import http from './client'

export const knowledgeBasesApi = {
  list: (params?: Record<string, unknown>) => http.get('/api/v1/knowledge-bases', { params }),
  get: (id: string) => http.get(`/api/v1/knowledge-bases/${id}`),
  create: (data: unknown) => http.post('/api/v1/knowledge-bases', data),
  update: (id: string, data: unknown) => http.patch(`/api/v1/knowledge-bases/${id}`, data),
  delete: (id: string) => http.delete(`/api/v1/knowledge-bases/${id}`),
}
