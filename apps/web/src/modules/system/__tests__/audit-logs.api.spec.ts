import { beforeEach, describe, expect, it, vi } from 'vitest'
import http from '@/api/client'
import { auditLogsApi } from '@/modules/system/api/audit-logs.api'

vi.mock('@/api/client', () => ({ default: { get: vi.fn() } }))

describe('auditLogsApi', () => {
  beforeEach(() => vi.clearAllMocks())

  it('requests the relative /audit-logs endpoint (no double /api/v1 prefix)', async () => {
    vi.mocked(http.get).mockResolvedValue({ items: [], total: 0, page: 1, pageSize: 20 })
    const params = { page: 2, pageSize: 20, action: 'DOCUMENT_UPLOAD', startDate: '2026-08-01' }
    await auditLogsApi.list(params)
    expect(http.get).toHaveBeenCalledWith('/audit-logs', { params })
  })

  it('normalizes a raw array response through the composable contract', async () => {
    vi.mocked(http.get).mockResolvedValue([{ id: 'log-1' }])
    const raw = await auditLogsApi.list()
    expect(Array.isArray(raw)).toBe(true)
  })
})
