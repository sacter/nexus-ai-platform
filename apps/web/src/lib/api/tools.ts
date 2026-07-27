import http from './client';

// tools API functions
// TODO: implement actual API calls
export const toolsApi = {
  list: (params?: Record<string, unknown>) => http.get('/api/v1/tools', { params }),
  get: (id: string) => http.get(`/api/v1/tools/${id}`),
  create: (data: unknown) => http.post('/api/v1/tools', data),
  update: (id: string, data: unknown) => http.patch(`/api/v1/tools/${id}`, data),
  delete: (id: string) => http.delete(`/api/v1/tools/${id}`),
};
