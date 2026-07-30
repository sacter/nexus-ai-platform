import http from './client'

export const documentsApi = {
  list: (kbId: string, params?: Record<string, unknown>) =>
    http.get(`/api/v1/knowledge-bases/${kbId}/documents`, { params }),
  get: (kbId: string, id: string) =>
    http.get(`/api/v1/knowledge-bases/${kbId}/documents/${id}`),
  upload: (kbId: string, formData: FormData) =>
    http.post(`/api/v1/knowledge-bases/${kbId}/documents/upload`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),
  delete: (kbId: string, id: string) =>
    http.delete(`/api/v1/knowledge-bases/${kbId}/documents/${id}`),
}
