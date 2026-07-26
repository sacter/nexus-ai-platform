import { api } from './client';

// jobs API functions
// TODO: implement actual API calls
export const jobsApi = {
  list: async (params?: Record<string, unknown>) => api(`/${params ? '?' + new URLSearchParams(params as Record<string,string>).toString() : ''}`),
  get: async (id: string) => api(`/api/v1/jobs/${id}`),
  create: async (data: unknown) => api('/api/v1/jobs', { method: 'POST', body: JSON.stringify(data) }),
  update: async (id: string, data: unknown) => api(`/api/v1/jobs/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  delete: async (id: string) => api(`/api/v1/jobs/${id}`, { method: 'DELETE' }),
};
