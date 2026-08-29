import http from '@/api/client'
export const toolsApi = {
  list: (params?: Record<string, unknown>) => http.get('/tools', { params }),
  get: (id: string) => http.get(`/tools/${id}`),
  create: (data: unknown) => http.post('/tools', data),
  update: (id: string, data: unknown) => http.patch(`/tools/${id}`, data),
  delete: (id: string) => http.delete(`/tools/${id}`),
}
