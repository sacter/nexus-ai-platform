import http from '@/api/client'
import type { AuditLogApiResponse, AuditLogListParams } from '../types/audit-log'

export const auditLogsApi = {
  /** 相对路径，勿加 /api/v1 前缀（client baseURL 已含） */
  list: (params?: AuditLogListParams) =>
    http.get<AuditLogApiResponse>('/audit-logs', { params }),
}
