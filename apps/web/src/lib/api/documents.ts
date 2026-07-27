import http from './client';

// documents API functions
// TODO: implement actual API calls
export const documentsApi = {
  list: (params?: Record<string, unknown>) => http.get('/api/v1/documents', { params }),
  get: (id: string) => http.get(`/api/v1/documents/${id}`),
  create: (data: unknown) => http.post('/api/v1/documents', data),
  update: (id: string, data: unknown) => http.patch(`/api/v1/documents/${id}`, data),
  delete: (id: string) => http.delete(`/api/v1/documents/${id}`),
};
