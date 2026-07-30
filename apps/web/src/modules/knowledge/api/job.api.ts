import http from '@/api/client'
export const jobsApi = {
  list: (params?: Record<string, unknown>) => http.get('/api/v1/jobs', { params }),
  get: (id: string) => http.get(`/api/v1/jobs/${id}`),
  cancel: (id: string) => http.post(`/api/v1/jobs/${id}/cancel`),
  retry: (id: string) => http.post(`/api/v1/jobs/${id}/retry`),
}
