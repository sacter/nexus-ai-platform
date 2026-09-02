import { Annotation } from '@langchain/langgraph';
import { BaseMessage } from '@langchain/core/messages';

const messagesReducer = (prev: BaseMessage[], next: BaseMessage[]) => [
  ...prev,
  ...next,
];

/**
 * 基础 Agent 状态 — 所有 Workflow 策略共享。
 * 使用 LangGraph 的 Annotation API（非 StateSchema，后者不存在）。
 *
 * 各策略可通过 workflows.config 传入自定义状态扩展，
 * 在构造 StateGraph 时通过 channels 参数合并。
    messages        — 消息列表（llm / 所有节点）
    kbId            — 知识库 ID（retriever）
    kbIds           — 多知识库（retriever）
    modelId         — 模型 ID（llm / reflection）
    sessionId       — 会话 ID（通用）
    promptTemplateId — 提示词模板（llm）
    toolIds         — 工具列表（tool）
    retrievedChunks — 检索结果（retriever）
    citations       — 引用信息（retriever）
    context         — 格式化上下文文本（llm）
    iteration       — 迭代次数（reflection）
    needsImprovement — 是否需要改进（reflection）
    judgeResult     — 评判结果（reflection）
    plan            — 子任务计划（planner）
    currentSubtask  — 当前子任务（solver）
    subtaskResults  — 子任务结果集（solver）
    agentOutputs    — 多 Agent 输出（aggregator）
    aggregatedResult — 合并结果（aggregator）
    toolResults     — 工具执行结果（tool）
    error           — 错误信息（所有节点）
 */

export const AgentStateAnnotation = Annotation.Root({
  messages: Annotation<BaseMessage[]>({
    reducer: messagesReducer,
    default: () => [],
  }),

  // ── 执行上下文（运行时由 ExecutionService 注入）──
  kbId: Annotation<string | undefined>(),
  kbIds: Annotation<string[]>(),
  modelId: Annotation<string | undefined>(),
  sessionId: Annotation<string | undefined>(),
  promptTemplateId: Annotation<string | undefined>(),
  toolIds: Annotation<string[]>(),

  // ── 检索结果 ──
  retrievedChunks: Annotation<any[]>(),
  citations: Annotation<any[]>(),
  context: Annotation<string | undefined>(),

  // ── Reflection 状态（ReflectionStrategy 使用）──
  iteration: Annotation<number>(),
  needsImprovement: Annotation<boolean>(),
  judgeResult: Annotation<string | undefined>(),

  // ── ReWOO 规划/求解（Planner + Solver 使用）──
  plan: Annotation<unknown>(),
  currentSubtask: Annotation<string | undefined>(),
  subtaskResults: Annotation<any[]>(),

  // ── Multi-Agent 聚合（Aggregator 使用）──
  agentOutputs: Annotation<any[]>(),
  aggregatedResult: Annotation<unknown>(),

  // ── 工具执行结果 ──
  toolResults: Annotation<any[]>(),

  // ── 错误（节点级兜底）──
  error: Annotation<string | undefined>(),
});

export type AgentState = typeof AgentStateAnnotation.State;
