import type { AuditAction, AuditLog, AuditLogApiResponse, AuditLogListResponse } from '../types/audit-log'

/**
 * The full known action space from the backend `audit_action` enum (DATABASE.md §4.11).
 * Unknown values are kept visible as-is so new backend actions never render blank.
 */
const ACTION_LABELS: Record<string, string> = {
  DOCUMENT_UPLOAD: '上传文档',
  DOCUMENT_DELETE: '删除文档',
  DOCUMENT_REINDEX: '重新索引',
  KB_CREATE: '创建知识库',
  KB_DELETE: '删除知识库',
  KB_UPDATE: '更新知识库',
  PERMISSION_CHANGE: '变更权限',
  SETTING_CHANGE: '修改设置',
  API_KEY_CREATE: '创建 API Key',
  API_KEY_DELETE: '删除 API Key',
  PROMPT_CREATE: '创建提示词',
  PROMPT_UPDATE: '更新提示词',
  USER_LOGIN: '登录',
  VERSION_ACTIVATE: '切换版本',
  AI_APP_CREATE: '创建应用',
  AI_APP_DELETE: '删除应用',
  AI_APP_UPDATE: '更新应用',
  MODEL_REGISTER: '注册模型',
  MODEL_DELETE: '删除模型',
  WORKFLOW_CREATE: '创建工作流',
  WORKFLOW_UPDATE: '更新工作流',
  WORKFLOW_EXECUTE: '执行工作流',
  TOOL_REGISTER: '注册工具',
  TOOL_DELETE: '删除工具',
  TOOL_EXECUTE: '执行工具',
  CHAT_FEEDBACK: '消息反馈',
}

const ENTITY_TYPE_LABELS: Record<string, string> = {
  document: '文档',
  knowledge_base: '知识库',
  document_version: '文档版本',
  ai_application: 'AI 应用',
  model: '模型',
  tool: '工具',
  workflow: '工作流',
  workflow_execution: '工作流执行',
  prompt_template: '提示词',
  api_key: 'API Key',
  user: '用户',
  session: '会话',
  message: '消息',
  setting: '系统设置',
  permission: '权限',
}

type TagType = 'success' | 'warning' | 'danger' | 'info' | 'primary'

export function auditActionLabel(action: AuditAction): string {
  return ACTION_LABELS[action] ?? action
}

export function auditActionTagType(action: AuditAction): TagType {
  if (/DELETE/.test(action)) return 'danger'
  if (/PERMISSION|SETTING/.test(action)) return 'warning'
  if (/CREATE|UPLOAD|REGISTER|ACTIVATE/.test(action)) return 'success'
  if (/UPDATE|REINDEX|CHANGE/.test(action)) return 'warning'
  return 'info'
}

export function entityTypeLabel(entityType: string): string {
  return ENTITY_TYPE_LABELS[entityType] ?? entityType
}

export function formatAuditDetails(
  details: AuditLog['details'] | undefined,
): string {
  if (details == null) return '--'
  if (typeof details === 'string') return details.trim() ? details : '--'
  if (typeof details === 'object' && Object.keys(details).length === 0) return '--'
  try {
    return JSON.stringify(details, null, 2)
  } catch {
    return '--'
  }
}

export function normalizeAuditLogResponse(response: AuditLogApiResponse): AuditLogListResponse {
  if (Array.isArray(response)) {
    return { items: response, total: response.length, page: 1, pageSize: Math.max(response.length, 10) }
  }
  return response
}

export const ACTION_OPTIONS: { label: string; value: string }[] = Object.entries(ACTION_LABELS).map(
  ([value, label]) => ({ label, value }),
)

export const ENTITY_TYPE_OPTIONS: { label: string; value: string }[] = Object.entries(
  ENTITY_TYPE_LABELS,
).map(([value, label]) => ({ label, value }))
