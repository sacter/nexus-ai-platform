import { RunnableConfig } from '@langchain/core/runnables';
import { AgentState } from './state.interface';
import { WorkflowNodeType } from './workflow.interface';

/**
 * 节点步骤事件
 */
export interface NodeStepEvent {
  nodeId: string;
  nodeType: WorkflowNodeType;
  status: 'running' | 'completed' | 'failed' | 'skipped';
  input?: Record<string, unknown>;
  output?: Record<string, unknown>;
  durationMs?: number;
  errorMessage?: string;
  startedAt: string;
  completedAt?: string;
}

/**
 * 节点步骤回调 — 由 ExecutionService 提供，避免 NodeRegistry 反向依赖 ExecutionService
 */
export type OnStepCallback = (event: NodeStepEvent) => void | Promise<void>;

/**
 * 节点执行上下文
 */
export interface NodeContext {
  state: AgentState;
  config: RunnableConfig;
  metadata: {
    nodeId: string;
    nodeType: WorkflowNodeType;
    workflowId: string;
    executionId: string;
  };
  /** 步骤回调：节点内部调用以通知 ExecutionService 写 node_steps */
  onStep: OnStepCallback;
}

/**
 * 节点实现接口 — 所有节点类型都遵循此接口
 */
export interface GraphNode {
  readonly type: WorkflowNodeType;
  readonly label: string;

  /** 核心执行方法 */
  execute(ctx: NodeContext): Promise<Partial<AgentState>>;

  /** 校验节点配置（来自 DB config JSONB） */
  validateConfig?(config: Record<string, unknown>): boolean;
}
