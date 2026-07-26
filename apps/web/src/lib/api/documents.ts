import { api } from './client';

// documents API functions
// TODO: implement actual API calls
export const documentsApi = {
  list: async (params?: Record<string, unknown>) => api(`/${params ? '?' + new URLSearchParams(params as Record<string,string>).toString() : ''}`),
  get: async (id: string) => api(`/api/v1/documents/${id}`),
  create: async (data: unknown) => api('/api/v1/documents', { method: 'POST', body: JSON.stringify(data) }),
  update: async (id: string, data: unknown) => api(`/api/v1/documents/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  delete: async (id: string) => api(`/api/v1/documents/${id}`, { method: 'DELETE' }),
};
