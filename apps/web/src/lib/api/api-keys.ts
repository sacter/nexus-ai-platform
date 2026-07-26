import { api } from './client';

// api-keys API functions
// TODO: implement actual API calls
export const api_keysApi = {
  list: async (params?: Record<string, unknown>) => api(`/${params ? '?' + new URLSearchParams(params as Record<string,string>).toString() : ''}`),
  get: async (id: string) => api(`/api/v1/api-keys/${id}`),
  create: async (data: unknown) => api('/api/v1/api-keys', { method: 'POST', body: JSON.stringify(data) }),
  update: async (id: string, data: unknown) => api(`/api/v1/api-keys/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  delete: async (id: string) => api(`/api/v1/api-keys/${id}`, { method: 'DELETE' }),
};
