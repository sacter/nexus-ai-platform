import type {
  CreateWorkflowInput,
  Workflow,
  WorkflowEdge,
  WorkflowEdgeInput,
  WorkflowNodeInput,
  WorkflowNodeType,
  WorkflowType,
} from '../types/workflow'

/** WorkflowForm 视图状态（提交前纯数据层；edges 通过 clientId 引用节点） */
export interface WorkflowFormState {
  name: string
  type: WorkflowType
  description: string
  isActive: boolean
  /** 顶层 config 的 JSON 文本（用户在 textarea 中编辑；提交时 parse） */
  configText: string
  nodes: NodeDraft[]
  edges: EdgeDraft[]
}

export interface NodeDraft {
  clientId: string
  type: WorkflowNodeType
  label: string
  description: string
  /** 该节点的 config 文本（JSON） */
  configText: string
}

export interface EdgeDraft {
  /** 源/目标节点的 clientId */
  sourceClientId: string
  targetClientId: string
  label: string
}

let clientSeq = 0
function newClientId(): string {
  return `n${++clientSeq}_${Date.now().toString(36)}`
}

export function emptyForm(): WorkflowFormState {
  return {
    name: '',
    type: 'rag',
    description: '',
    isActive: true,
    configText: '{\n  "retriever": { "topK": 4 }\n}',
    nodes: [
      { clientId: newClientId(), type: 'start', label: '开始', description: '', configText: '{}' },
      {
        clientId: newClientId(),
        type: 'retriever',
        label: '检索',
        description: '',
        configText: '{\n  "topK": 4\n}',
      },
      { clientId: newClientId(), type: 'llm', label: 'LLM 生成', description: '', configText: '{}' },
      { clientId: newClientId(), type: 'end', label: '结束', description: '', configText: '{}' },
    ],
    edges: [],
  }
}

/** 详情 → 表单（编辑模式回填） */
export function formFromWorkflow(wf: Workflow): WorkflowFormState {
  const nodeDrafts: NodeDraft[] = (wf.nodes ?? []).map((n) => ({
    clientId: n.id, // 直接用真实 id 作为 clientId，便于边引用
    type: n.type,
    label: n.label,
    description: n.description ?? '',
    configText: JSON.stringify(n.config ?? {}, null, 2),
  }))
  const idSet = new Set((wf.nodes ?? []).map((n) => n.id))
  const edgeDrafts: EdgeDraft[] = (wf.edges ?? [])
    .filter((e) => idSet.has(e.sourceNodeId) && idSet.has(e.targetNodeId))
    .map((e: WorkflowEdge) => ({
      sourceClientId: e.sourceNodeId,
      targetClientId: e.targetNodeId,
      label: e.label ?? '',
    }))
  return {
    name: wf.name,
    type: wf.type,
    description: wf.description ?? '',
    isActive: wf.isActive,
    configText: JSON.stringify(wf.config ?? {}, null, 2),
    nodes: nodeDrafts,
    edges: edgeDrafts,
  }
}

export function addClientNode(form: WorkflowFormState, type: WorkflowNodeType = 'llm') {
  form.nodes.push({
    clientId: newClientId(),
    type,
    label: '',
    description: '',
    configText: '{}',
  })
}

export function addEdge(form: WorkflowFormState) {
  const first = form.nodes[0]
  const second = form.nodes[1] ?? first
  if (!first || !second) return
  form.edges.push({ sourceClientId: first.clientId, targetClientId: second.clientId, label: '' })
}

export function removeNode(form: WorkflowFormState, clientId: string) {
  const idx = form.nodes.findIndex((n) => n.clientId === clientId)
  if (idx < 0) return
  form.nodes.splice(idx, 1)
  // 同时移除引用该节点的边
  form.edges = form.edges.filter(
    (e) => e.sourceClientId !== clientId && e.targetClientId !== clientId,
  )
}

export function removeEdge(form: WorkflowFormState, idx: number) {
  form.edges.splice(idx, 1)
}

/** 解析 JSON 文本，失败抛错（包含字段名提示） */
function parseJsonField(text: string, label: string): Record<string, unknown> {
  const trimmed = (text ?? '').trim()
  if (!trimmed) return {}
  try {
    const v = JSON.parse(trimmed)
    if (v === null || typeof v !== 'object' || Array.isArray(v)) {
      throw new Error('必须是对象')
    }
    return v as Record<string, unknown>
  } catch (e) {
    throw new Error(`${label} 不是合法 JSON：${(e as Error).message}`)
  }
}

/**
 * 表单 → 提交 payload：trim、JSON parse、空边过滤。
 * 抛出错误时由调用方 catch 并提示（表单提交按钮 click 处理器负责）。
 */
export function buildWorkflowPayload(form: WorkflowFormState): CreateWorkflowInput {
  const name = form.name.trim()
  if (!name) throw new Error('请输入工作流名称')
  if (!form.type) throw new Error('请选择工作流类型')

  const description = form.description.trim()
  const config = parseJsonField(form.configText, '顶层 config')

  const nodes: WorkflowNodeInput[] = form.nodes.map((n, i) => {
    const label = n.label.trim() || `${n.type} #${i + 1}`
    return {
      clientId: n.clientId,
      type: n.type,
      label,
      description: n.description.trim() || null,
      positionX: (i % 4) * 220,
      positionY: Math.floor(i / 4) * 140,
      config: parseJsonField(n.configText, `节点「${label}」的 config`),
    } as WorkflowNodeInput
  })

  const nodeIds = new Set(form.nodes.map((n) => n.clientId))
  const edges: WorkflowEdgeInput[] = form.edges
    .filter((e) => e.sourceClientId && e.targetClientId && nodeIds.has(e.sourceClientId) && nodeIds.has(e.targetClientId))
    .map((e) => ({
      sourceClientId: e.sourceClientId,
      targetClientId: e.targetClientId,
      sourceHandle: null,
      targetHandle: null,
      label: e.label.trim() || null,
      condition: null,
    }))

  // 自环防御
  for (const e of edges) {
    if (e.sourceClientId === e.targetClientId) {
      throw new Error('存在自环边（起点和终点是同一个节点），请调整')
    }
  }

  return {
    name,
    type: form.type,
    ...(description ? { description } : {}),
    config,
    isActive: form.isActive,
    nodes,
    edges,
  }
}
