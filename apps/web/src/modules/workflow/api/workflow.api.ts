import http from '@/api/client'
import type {
  CreateWorkflowInput,
  RunWorkflowInput,
  UpdateWorkflowInput,
  Workflow,
  WorkflowExecution,
} from '../types/workflow'

/**
 * Workflow REST API — 后端 NestJS 控制器前缀 'workflows'（相对路径，client 自动拼接 /api/v1）。
 * P4 契约：POST/PATCH 接受嵌套 nodes[]/edges[]（事务写入 workflow_nodes/workflow_edges）。
 */
export const workflowsApi = {
  list: () => http.get<Workflow[]>('/workflows'),
  get: (id: string) => http.get<Workflow>(`/workflows/${id}`),
  create: (data: CreateWorkflowInput) => http.post<Workflow>('/workflows', data),
  update: (id: string, data: UpdateWorkflowInput) =>
    http.patch<Workflow>(`/workflows/${id}`, data),
  delete: (id: string) => http.delete<{ id: string }>(`/workflows/${id}`),
  /** 手动执行 Workflow（P4 Task 4.2）；返回创建出的 execution */
  run: (id: string, data: RunWorkflowInput = {}) =>
    http.post<WorkflowExecution>(`/workflows/${id}/run`, data),
  /** 执行历史列表 */
  listExecutions: (id: string) =>
    http.get<WorkflowExecution[]>(`/workflows/${id}/executions`),
  /** 单次执行详情（含 node_steps） */
  getExecution: (id: string, execId: string) =>
    http.get<WorkflowExecution>(`/workflows/${id}/executions/${execId}`),
}
