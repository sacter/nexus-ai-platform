import http from './client'

export const aiApplicationsApi = {
  list: (params?: Record<string, unknown>) => http.get('/api/v1/ai-applications', { params }),
  get: (id: string) => http.get(`/api/v1/ai-applications/${id}`),
  create: (data: unknown) => http.post('/api/v1/ai-applications', data),
  update: (id: string, data: unknown) => http.patch(`/api/v1/ai-applications/${id}`, data),
  delete: (id: string) => http.delete(`/api/v1/ai-applications/${id}`),
}
