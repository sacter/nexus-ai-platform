import http from '@/api/client'
export const promptsApi = {
  list: () => http.get('/prompt-template'),
  get: (id: string) => http.get(`/prompt-template/${id}`),
  create: (data: unknown) => http.post('/prompt-template', data),
  update: (id: string, data: unknown) => http.patch(`/prompt-template/${id}`, data),
  delete: (id: string) => http.delete(`/prompt-template/${id}`),
}
