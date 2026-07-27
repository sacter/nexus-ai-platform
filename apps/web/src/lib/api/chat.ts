import http from './client';

// chat API functions
// TODO: implement actual API calls
export const chatApi = {
  list: (params?: Record<string, unknown>) => http.get('/api/v1/chat', { params }),
  get: (id: string) => http.get(`/api/v1/chat/${id}`),
  create: (data: unknown) => http.post('/api/v1/chat', data),
  update: (id: string, data: unknown) => http.patch(`/api/v1/chat/${id}`, data),
  delete: (id: string) => http.delete(`/api/v1/chat/${id}`),
};
