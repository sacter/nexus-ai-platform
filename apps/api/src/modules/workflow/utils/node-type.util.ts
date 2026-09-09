import { WorkflowNodeType } from '../interface/workflow.interface';

export const NODE_TYPE_MAP: Record<string, WorkflowNodeType> = {
  router: 'router',
  retriever: 'retriever',
  llm: 'llm',
  judge: 'reflection',
  planner: 'planner',
  solver: 'solver',
  aggregator: 'aggregator',
};

export function resolveNodeType(nodeName: string): WorkflowNodeType {
  return NODE_TYPE_MAP[nodeName] ?? 'llm';
}
