import http from './client';

// chunks API functions
// TODO: implement actual API calls
export const chunksApi = {
  list: (params?: Record<string, unknown>) => http.get('/api/v1/chunks', { params }),
  get: (id: string) => http.get(`/api/v1/chunks/${id}`),
  create: (data: unknown) => http.post('/api/v1/chunks', data),
  update: (id: string, data: unknown) => http.patch(`/api/v1/chunks/${id}`, data),
  delete: (id: string) => http.delete(`/api/v1/chunks/${id}`),
};
