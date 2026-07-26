import { api } from './client';

// chat API functions
// TODO: implement actual API calls
export const chatApi = {
  list: async (params?: Record<string, unknown>) => api(`/${params ? '?' + new URLSearchParams(params as Record<string,string>).toString() : ''}`),
  get: async (id: string) => api(`/api/v1/chat/${id}`),
  create: async (data: unknown) => api('/api/v1/chat', { method: 'POST', body: JSON.stringify(data) }),
  update: async (id: string, data: unknown) => api(`/api/v1/chat/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  delete: async (id: string) => api(`/api/v1/chat/${id}`, { method: 'DELETE' }),
};
