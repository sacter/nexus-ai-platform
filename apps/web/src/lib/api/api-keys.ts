import http from './client';

// api-keys API functions
// TODO: implement actual API calls
export const api_keysApi = {
  list: (params?: Record<string, unknown>) => http.get('/api/v1/api-keys', { params }),
  get: (id: string) => http.get(`/api/v1/api-keys/${id}`),
  create: (data: unknown) => http.post('/api/v1/api-keys', data),
  update: (id: string, data: unknown) => http.patch(`/api/v1/api-keys/${id}`, data),
  delete: (id: string) => http.delete(`/api/v1/api-keys/${id}`),
};
