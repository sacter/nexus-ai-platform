import { NodeStepEvent, OnStepCallback } from './node.interface';
import { WorkflowType, ChatMessage, Tool } from './workflow.interface';

/** 策略运行上下文 — 由 ExecutionService 装配 */
export interface WorkflowExecutionContext {
  workflow: {
    id: string;
    type: WorkflowType;
    config: Record<string, unknown>; // workflows.config JSONB
  };
  executionId: string;
  input: {
    question: string;
    chatHistory?: ChatMessage[];
    kbIds?: string[];
    modelId?: string;
    tools?: Tool[];
  };
  /** 步骤回调 — 策略内部传给 NodeRegistry.getNodeFn() */
  onStep: OnStepCallback;
  /** 超时 AbortSignal — ExecutionService 注入 */
  signal?: AbortSignal;
  /** 运行配置 */
  timeoutMs?: number;
}

/** 运行时步骤事件 — 写入 node_steps 并转为 SSE */
export interface WorkflowStrategy {
  readonly type: WorkflowType;

  /**
   * 执行 Workflow，逐步产出事件。
   * ExecutionService 消费事件 → 内存累积 node_steps → 批量写 DB → SSE 推前端
   */
  run(ctx: WorkflowExecutionContext): AsyncGenerator<NodeStepEvent, void, void>;
}
