import { api } from './client';

// prompts API functions
// TODO: implement actual API calls
export const promptsApi = {
  list: async (params?: Record<string, unknown>) => api(`/${params ? '?' + new URLSearchParams(params as Record<string,string>).toString() : ''}`),
  get: async (id: string) => api(`/api/v1/prompts/${id}`),
  create: async (data: unknown) => api('/api/v1/prompts', { method: 'POST', body: JSON.stringify(data) }),
  update: async (id: string, data: unknown) => api(`/api/v1/prompts/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  delete: async (id: string) => api(`/api/v1/prompts/${id}`, { method: 'DELETE' }),
};
