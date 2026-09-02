import { NodeStepEvent } from './node.interface';

export type WorkflowType =
  'rag' | 'reflection' | 'rewoo' | 'multi_agent' | 'custom';

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
  | 'code';

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface Tool {
  id: string;
  name: string;
  type: string;
  config?: Record<string, any>;
}

export interface ExecutionResponse {
  id: string;
  workflowId: string;
  status: string;
  input: any;
  output?: any;
  durationMs?: number;
  errorMessage?: string;
  nodeSteps: NodeStepEvent[];
  startedAt?: string;
  completedAt?: string;
  createdAt: string;
}

export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

export type NodeStep = NodeStepEvent;
