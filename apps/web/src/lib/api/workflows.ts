import { api } from './client';

// workflows API functions
// TODO: implement actual API calls
export const workflowsApi = {
  list: async (params?: Record<string, unknown>) => api(`/${params ? '?' + new URLSearchParams(params as Record<string,string>).toString() : ''}`),
  get: async (id: string) => api(`/api/v1/workflows/${id}`),
  create: async (data: unknown) => api('/api/v1/workflows', { method: 'POST', body: JSON.stringify(data) }),
  update: async (id: string, data: unknown) => api(`/api/v1/workflows/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  delete: async (id: string) => api(`/api/v1/workflows/${id}`, { method: 'DELETE' }),
};
