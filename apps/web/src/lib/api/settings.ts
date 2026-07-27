import http from './client';

// settings API functions
// TODO: implement actual API calls
export const settingsApi = {
  list: (params?: Record<string, unknown>) => http.get('/api/v1/settings', { params }),
  get: (id: string) => http.get(`/api/v1/settings/${id}`),
  create: (data: unknown) => http.post('/api/v1/settings', data),
  update: (id: string, data: unknown) => http.patch(`/api/v1/settings/${id}`, data),
  delete: (id: string) => http.delete(`/api/v1/settings/${id}`),
};
