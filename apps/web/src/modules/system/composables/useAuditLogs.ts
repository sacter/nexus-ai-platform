import { useQuery } from '@tanstack/vue-query'
import { toValue, type MaybeRef } from 'vue'
import { auditLogsApi } from '@/modules/system/api/audit-logs.api'
import { normalizeAuditLogResponse } from '@/modules/system/utils/audit-log-display'
import type { AuditLogListParams } from '@/modules/system/types/audit-log'

export function useAuditLogs(params: MaybeRef<AuditLogListParams>) {
  return useQuery({
    queryKey: ['audit-logs', params],
    queryFn: async () => normalizeAuditLogResponse(await auditLogsApi.list(toValue(params))),
    placeholderData: (previousData) => previousData,
  })
}
