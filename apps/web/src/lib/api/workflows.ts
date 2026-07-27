import http from './client';

// workflows API functions
// TODO: implement actual API calls
export const workflowsApi = {
  list: (params?: Record<string, unknown>) => http.get('/api/v1/workflows', { params }),
  get: (id: string) => http.get(`/api/v1/workflows/${id}`),
  create: (data: unknown) => http.post('/api/v1/workflows', data),
  update: (id: string, data: unknown) => http.patch(`/api/v1/workflows/${id}`, data),
  delete: (id: string) => http.delete(`/api/v1/workflows/${id}`),
};
