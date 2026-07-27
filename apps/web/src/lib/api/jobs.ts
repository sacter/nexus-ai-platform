import http from './client';

// jobs API functions
// TODO: implement actual API calls
export const jobsApi = {
  list: (params?: Record<string, unknown>) => http.get('/api/v1/jobs', { params }),
  get: (id: string) => http.get(`/api/v1/jobs/${id}`),
  create: (data: unknown) => http.post('/api/v1/jobs', data),
  update: (id: string, data: unknown) => http.patch(`/api/v1/jobs/${id}`, data),
  delete: (id: string) => http.delete(`/api/v1/jobs/${id}`),
};
