// Workflow 类型枚举 — 单一来源（DATABASE.md workflow_type_enum / chat_sessions.workflow_type CHECK）
// api（DTO @IsIn 校验）、web（新建会话弹窗、会话列表 tag）、后期 Workflow 模块共用
export const WORKFLOW_TYPES = ['rag', 'reflection', 'rewoo', 'multi_agent'] as const;

export type WorkflowType = (typeof WORKFLOW_TYPES)[number];

export const DEFAULT_WORKFLOW_TYPE: WorkflowType = 'rag';

export const WORKFLOW_TYPE_LABELS: Record<WorkflowType, string> = {
  rag: 'RAG 问答',
  reflection: 'Reflection',
  rewoo: 'ReWOO',
  multi_agent: '多智能体',
};
