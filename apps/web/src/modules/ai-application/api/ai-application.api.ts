import http from '@/api/client'

export const aiApplicationsApi = {
  list: (params?: Record<string, unknown>) => http.get('/ai-application', { params }),
  get: (id: string) => http.get(`/ai-application/${id}`),
  create: (data: unknown) => http.post('/ai-application', data),
  update: (id: string, data: unknown) => http.patch(`/ai-application/${id}`, data),
  delete: (id: string) => http.delete(`/ai-application/${id}`),
}
