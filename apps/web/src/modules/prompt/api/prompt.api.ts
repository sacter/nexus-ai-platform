import http from '@/api/client'
export const promptsApi = {
  list: () => http.get('/prompt-templates'),
  get: (id: string) => http.get(`/prompt-templates/${id}`),
  create: (data: unknown) => http.post('/prompt-templates', data),
  update: (id: string, data: unknown) => http.patch(`/prompt-templates/${id}`, data),
  delete: (id: string) => http.delete(`/prompt-templates/${id}`),
}
