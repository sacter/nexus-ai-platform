import http from './client'
export const auditLogsApi = {
  list: (params?: Record<string, unknown>) => http.get('/api/v1/audit-logs', { params }),
}
