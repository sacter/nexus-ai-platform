import { RunnableConfig } from '@langchain/core/runnables';
import { AgentState } from './state.interface';

/** 节点步骤事件 */
export interface NodeStepEvent {
  nodeId: string;
  nodeType: string;
  status: 'running' | 'completed' | 'failed' | 'skipped';
  input?: Record<string, unknown>;
  output?: Record<string, unknown>;
  durationMs?: number;
  errorMessage?: string;
  startedAt: string;
  completedAt?: string;
}
/** 节点步骤回调 — 由 ExecutionService 提供 */
export type OnStepCallback = (event: NodeStepEvent) => void | Promise<void>;

/** 节点执行上下文 */
export interface NodeContext {
  state: AgentState;
  config: RunnableConfig;
  metadata: {
    nodeId: string;
    nodeType: string;
    workflowId: string;
    executionId: string;
  };
  onStep: OnStepCallback;
}

/** 节点实现接口 */
export interface GraphNode {
  readonly type: string;
  readonly label: string;
  execute(ctx: NodeContext): Promise<Partial<AgentState>>;
  validateConfig?(config: Record<string, unknown>): boolean;
}
