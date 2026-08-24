export type AuditAction = string

export interface AuditLog {
  id: string
  userId: string | null
  username?: string | null
  action: AuditAction
  entityType: string
  entityId: string | null
  kbId: string | null
  kbName?: string | null
  details: Record<string, unknown> | string | null
  ipAddress: string | null
  createdAt: string
}

export interface AuditLogListParams {
  page?: number
  pageSize?: number
  keyword?: string
  user?: string
  action?: string
  entityType?: string
  kbId?: string
  startDate?: string
  endDate?: string
}

export interface AuditLogListResponse {
  items: AuditLog[]
  total: number
  page: number
  pageSize: number
}

export type AuditLogApiResponse = AuditLogListResponse | AuditLog[]
