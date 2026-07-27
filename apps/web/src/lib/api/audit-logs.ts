import http from './client';

// audit-logs API functions
// TODO: implement actual API calls
export const audit_logsApi = {
  list: (params?: Record<string, unknown>) => http.get('/api/v1/audit-logs', { params }),
  get: (id: string) => http.get(`/api/v1/audit-logs/${id}`),
  create: (data: unknown) => http.post('/api/v1/audit-logs', data),
  update: (id: string, data: unknown) => http.patch(`/api/v1/audit-logs/${id}`, data),
  delete: (id: string) => http.delete(`/api/v1/audit-logs/${id}`),
};
