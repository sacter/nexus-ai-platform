import http from '@/api/client'
export const promptsApi = {
  list: () => http.get('/api/v1/prompts'),
  get: (id: string) => http.get(`/api/v1/prompts/${id}`),
  create: (data: unknown) => http.post('/api/v1/prompts', data),
  update: (id: string, data: unknown) => http.patch(`/api/v1/prompts/${id}`, data),
  delete: (id: string) => http.delete(`/api/v1/prompts/${id}`),
}
