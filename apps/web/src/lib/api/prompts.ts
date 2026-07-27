import http from './client';

// prompts API functions
// TODO: implement actual API calls
export const promptsApi = {
  list: (params?: Record<string, unknown>) => http.get('/api/v1/prompts', { params }),
  get: (id: string) => http.get(`/api/v1/prompts/${id}`),
  create: (data: unknown) => http.post('/api/v1/prompts', data),
  update: (id: string, data: unknown) => http.patch(`/api/v1/prompts/${id}`, data),
  delete: (id: string) => http.delete(`/api/v1/prompts/${id}`),
};
