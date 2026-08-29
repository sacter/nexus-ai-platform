/**
 * Workflow（workflows / workflow_nodes / workflow_edges / workflow_executions）前端类型
 * 与 prisma/schema.prisma 对齐（camelCase），并符合 P4 后端契约（嵌套 nodes/edges 写入）
 */

import type { WorkflowType } from '@nexus/config'

export type { WorkflowType }
export { WORKFLOW_TYPES, WORKFLOW_TYPE_LABELS, DEFAULT_WORKFLOW_TYPE } from '@nexus/config'

/** DATABASE.md §4.15 workflow_node_type_enum */
export type WorkflowNodeType =
  | 'start'
  | 'end'
  | 'retriever'
  | 'llm'
  | 'tool'
  | 'condition'
  | 'reflection'
  | 'planner'
  | 'solver'
  | 'aggregator'
  | 'code'

export const WORKFLOW_NODE_TYPES: WorkflowNodeType[] = [
  'start',
  'end',
  'retriever',
  'llm',
  'tool',
  'condition',
  'reflection',
  'planner',
  'solver',
  'aggregator',
  'code',
]

export const WORKFLOW_NODE_TYPE_LABELS: Record<WorkflowNodeType, string> = {
  start: '开始',
  end: '结束',
  retriever: '检索',
  llm: 'LLM',
  tool: '工具',
  condition: '条件分支',
  reflection: '反思自查',
  planner: '规划器',
  solver: '求解器',
  aggregator: '聚合',
  code: '代码',
}

/** DATABASE.md §4.17 workflow_executions.status enums */
export type ExecutionStatus = 'RUNNING' | 'COMPLETED' | 'FAILED' | 'CANCELLED' | 'PAUSED' | 'WAITING'

export const EXECUTION_STATUS: { value: ExecutionStatus; label: string; tagType: 'success' | 'info' | 'warning' | 'danger' | 'primary' }[] = [
  { value: 'RUNNING', label: '运行中', tagType: 'primary' },
  { value: 'COMPLETED', label: '已完成', tagType: 'success' },
  { value: 'FAILED', label: '失败', tagType: 'danger' },
  { value: 'CANCELLED', label: '已取消', tagType: 'info' },
  { value: 'PAUSED', label: '已暂停', tagType: 'warning' },
  { value: 'WAITING', label: '等待中', tagType: 'warning' },
]

export function executionStatusMeta(status: ExecutionStatus | string) {
  return (
    EXECUTION_STATUS.find((s) => s.value === status) ?? {
      value: status as ExecutionStatus,
      label: status,
      tagType: 'info' as const,
    }
  )
}

/** workflows.config JSONB —— 各 type 自定义（rag/reflection/rewoo/multi_agent） */
export type WorkflowConfig = Record<string, unknown>

/** workflow_nodes.config JSONB —— 节点级配置（retriever 的 kb_ids/topK、llm 的 temperature 等） */
export type WorkflowNodeConfig = Record<string, unknown>

/** workflows 一条记录 */
export interface Workflow {
  id: string
  name: string
  type: WorkflowType
  description: string | null
  version: number
  config: WorkflowConfig
  isActive: boolean
  createdBy: string | null
  createdAt: string
  updatedAt: string
  /** 详情接口返回内嵌图结构（list 接口可能省略） */
  nodes?: WorkflowNode[]
  edges?: WorkflowEdge[]
  /** 列表接口可选统计（后端可能返回） */
  executionCount?: number
}

export interface WorkflowNode {
  id: string
  workflowId: string
  type: WorkflowNodeType
  label: string
  description: string | null
  positionX: number
  positionY: number
  config: WorkflowNodeConfig
  createdAt?: string
  updatedAt?: string
}

export interface WorkflowEdge {
  id: string
  workflowId: string
  sourceNodeId: string
  targetNodeId: string
  sourceHandle: string | null
  targetHandle: string | null
  label: string | null
  condition: unknown | null
}

/** 写入时不再要求 id（后端生成） —— P4 契约：POST/PATCH 接受嵌套 nodes[]/edges[] */
export type WorkflowNodeInput = Omit<WorkflowNode, 'id' | 'workflowId' | 'createdAt' | 'updatedAt'> & {
  /** 客户端本地临时 id（edges 通过 clientId 引用）；后端落库时替换 */
  clientId: string
}
export type WorkflowEdgeInput = Omit<WorkflowEdge, 'id' | 'workflowId' | 'sourceNodeId' | 'targetNodeId'> & {
  /** 指向 WorkflowNodeInput.clientId */
  sourceClientId: string
  targetClientId: string
}

export interface CreateWorkflowInput {
  name: string
  type: WorkflowType
  description?: string
  config?: WorkflowConfig
  isActive?: boolean
  nodes?: WorkflowNodeInput[]
  edges?: WorkflowEdgeInput[]
}
export type UpdateWorkflowInput = Partial<CreateWorkflowInput>

/** workflow_executions.node_steps[] 单步 */
export interface WorkflowNodeStep {
  nodeId: string
  nodeLabel?: string
  nodeType?: WorkflowNodeType
  status: ExecutionStatus | 'SKIPPED'
  input?: unknown
  output?: unknown
  error?: string | null
  startedAt?: string
  completedAt?: string
  durationMs?: number
}

/** workflow_executions 一条记录 */
export interface WorkflowExecution {
  id: string
  workflowId: string | null
  applicationId: string | null
  sessionId: string | null
  input: Record<string, unknown>
  output: unknown | null
  status: ExecutionStatus
  durationMs: number | null
  errorMessage: string | null
  nodeSteps: WorkflowNodeStep[]
  startedAt: string | null
  completedAt: string | null
  createdAt: string
}

export interface RunWorkflowInput {
  input?: Record<string, unknown>
}

/** 类型元信息（卡片/表单图标) */
export const WORKFLOW_TYPE_META: Record<WorkflowType, { icon: string; color: string; hint: string }> = {
  rag: {
    icon: '🔍',
    color: '#5b8def',
    hint: '检索 → LLM 一战式问答（最常用）',
  },
  reflection: {
    icon: '🪞',
    color: '#a371f7',
    hint: '生成 → 自查 → 修正，提升复杂问答准确度',
  },
  rewoo: {
    icon: '🧠',
    color: '#d29922',
    hint: '规划器 + 执行器；V2 打桩，V4.5 落地',
  },
  multi_agent: {
    icon: '🤖',
    color: '#3fb950',
    hint: '多智能体协作；V2 打桩，V4.5 落地',
  },
}
