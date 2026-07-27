import http from './client';

// models API functions
// TODO: implement actual API calls
export const modelsApi = {
  list: (params?: Record<string, unknown>) => http.get('/api/v1/models', { params }),
  get: (id: string) => http.get(`/api/v1/models/${id}`),
  create: (data: unknown) => http.post('/api/v1/models', data),
  update: (id: string, data: unknown) => http.patch(`/api/v1/models/${id}`, data),
  delete: (id: string) => http.delete(`/api/v1/models/${id}`),
};
