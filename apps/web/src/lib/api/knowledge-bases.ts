import { api } from './client';

// knowledge-bases API functions
// TODO: implement actual API calls
export const knowledge_basesApi = {
  list: async (params?: Record<string, unknown>) => api(`/${params ? '?' + new URLSearchParams(params as Record<string,string>).toString() : ''}`),
  get: async (id: string) => api(`/api/v1/knowledge-bases/${id}`),
  create: async (data: unknown) => api('/api/v1/knowledge-bases', { method: 'POST', body: JSON.stringify(data) }),
  update: async (id: string, data: unknown) => api(`/api/v1/knowledge-bases/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  delete: async (id: string) => api(`/api/v1/knowledge-bases/${id}`, { method: 'DELETE' }),
};
