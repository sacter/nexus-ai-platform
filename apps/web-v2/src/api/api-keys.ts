import http from './client'
export const apiKeysApi = {
  list: () => http.get('/api/v1/api-keys'),
  create: (data: unknown) => http.post('/api/v1/api-keys', data),
  delete: (id: string) => http.delete(`/api/v1/api-keys/${id}`),
}
