import http from '@/api/client'
import type { JobListParams, JobListResponse, IndexJob } from '../types/job'

export const jobsApi = {
  /** 相对路径，勿加 /api/v1 前缀 */
  list: (params?: JobListParams) => http.get<JobListResponse>('/jobs', { params }),
  get: (id: string) => http.get<IndexJob>(`/jobs/${id}`),
  cancel: (id: string) => http.post<IndexJob>(`/jobs/${id}/cancel`),
  retry: (id: string) => http.post<IndexJob>(`/jobs/${id}/retry`),
}
