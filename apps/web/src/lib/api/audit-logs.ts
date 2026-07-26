import { api } from './client';

// audit-logs API functions
// TODO: implement actual API calls
export const audit_logsApi = {
  list: async (params?: Record<string, unknown>) => api(`/${params ? '?' + new URLSearchParams(params as Record<string,string>).toString() : ''}`),
  get: async (id: string) => api(`/api/v1/audit-logs/${id}`),
  create: async (data: unknown) => api('/api/v1/audit-logs', { method: 'POST', body: JSON.stringify(data) }),
  update: async (id: string, data: unknown) => api(`/api/v1/audit-logs/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  delete: async (id: string) => api(`/api/v1/audit-logs/${id}`, { method: 'DELETE' }),
};
