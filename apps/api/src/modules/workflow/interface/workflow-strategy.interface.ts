import { NodeStepEvent, OnStepCallback } from './node.interface';
import { WorkflowType, ChatMessage, Tool } from './workflow.interface';

/** 策略运行上下文 — 由 ExecutionService 装配 */
export interface WorkflowExecutionContext {
  workflow: {
    id: string;
    type: WorkflowType;
    config: Record<string, unknown>;
  };
  executionId: string;
  input: {
    question: string;
    chatHistory?: ChatMessage[];
    kbIds?: string[];
    modelId?: string;
    tools?: Tool[];
  };
  onStep: OnStepCallback;
  signal?: AbortSignal;
  timeoutMs?: number;
}

export interface WorkflowStrategy {
  readonly type: WorkflowType;
  run(ctx: WorkflowExecutionContext): AsyncGenerator<NodeStepEvent, void, void>;
}
