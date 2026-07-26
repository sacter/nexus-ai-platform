import { api } from './client';

// ai-applications API functions
// TODO: implement actual API calls
export const ai_applicationsApi = {
  list: async (params?: Record<string, unknown>) => api(`/${params ? '?' + new URLSearchParams(params as Record<string,string>).toString() : ''}`),
  get: async (id: string) => api(`/api/v1/ai-applications/${id}`),
  create: async (data: unknown) => api('/api/v1/ai-applications', { method: 'POST', body: JSON.stringify(data) }),
  update: async (id: string, data: unknown) => api(`/api/v1/ai-applications/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  delete: async (id: string) => api(`/api/v1/ai-applications/${id}`, { method: 'DELETE' }),
};
