import { describe, expect, it } from 'vitest'
import type { AuditLog } from '@/modules/system/types/audit-log'
import {
  auditActionLabel,
  auditActionTagType,
  entityTypeLabel,
  formatAuditDetails,
  normalizeAuditLogResponse,
} from '@/modules/system/utils/audit-log-display'

const baseLog: AuditLog = {
  id: 'log-1',
  userId: 'user-1',
  username: 'zhang',
  action: 'DOCUMENT_UPLOAD',
  entityType: 'document',
  entityId: 'doc-1',
  kbId: 'kb-1',
  kbName: 'HR 知识库',
  details: { fileName: '员工手册.pdf', version: 3 },
  ipAddress: '10.0.0.8',
  createdAt: '2026-08-24T10:30:00.000Z',
}

describe('audit log display helpers', () => {
  it('maps known actions and keeps unknown actions visible', () => {
    expect(auditActionLabel('DOCUMENT_UPLOAD')).toBe('上传文档')
    expect(auditActionLabel('DOCUMENT_DELETE')).toBe('删除文档')
    expect(auditActionLabel('UNKNOWN_ACTION')).toBe('UNKNOWN_ACTION')
  })

  it('uses semantic tag types for destructive and sensitive actions', () => {
    expect(auditActionTagType('DOCUMENT_DELETE')).toBe('danger')
    expect(auditActionTagType('PERMISSION_CHANGE')).toBe('warning')
    expect(auditActionTagType('DOCUMENT_UPLOAD')).toBe('success')
    expect(auditActionTagType('USER_LOGIN')).toBe('info')
  })

  it('maps entity types and keeps unknown types readable', () => {
    expect(entityTypeLabel('knowledge_base')).toBe('知识库')
    expect(entityTypeLabel('document')).toBe('文档')
    expect(entityTypeLabel('custom_entity')).toBe('custom_entity')
  })

  it('formats JSON details and empty details safely', () => {
    expect(formatAuditDetails(baseLog.details)).toContain('员工手册.pdf')
    expect(formatAuditDetails(null)).toBe('--')
    expect(formatAuditDetails({})).toBe('--')
    expect(formatAuditDetails('plain detail')).toBe('plain detail')
  })

  it('normalizes paginated responses', () => {
    expect(
      normalizeAuditLogResponse({ items: [baseLog], total: 12, page: 2, pageSize: 10 }),
    ).toEqual({ items: [baseLog], total: 12, page: 2, pageSize: 10 })
  })

  it('normalizes legacy array responses', () => {
    expect(normalizeAuditLogResponse([baseLog])).toEqual({
      items: [baseLog],
      total: 1,
      page: 1,
      pageSize: 10,
    })
  })
})
