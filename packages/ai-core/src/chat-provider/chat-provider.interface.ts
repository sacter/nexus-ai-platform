export type ChatRole = 'system' | 'user' | 'assistant';

export interface ChatMessage {
  role: ChatRole;
  content: string;
}

/**
 * 协议名：wire format，不是厂商。
 * openai-compatible 是默认协议（DashScope 兼容模式/DeepSeek/Kimi/智谱/Ollama 兼容端点均兼容），
 * 绝大多数 models.provider 都走它，差异全在 baseUrl/apiKey/model/参数（数据驱动）。
 * 只有协议真不同的厂商（如某家原生接口非 OpenAI 兼容）才新增协议名 + client 实现。
 */
export type ChatProtocol = 'openai-compatible' | 'ollama-native';

/**
 * 统一入参面 —— 所有消费者共用一个请求对象，字段全部可选，按需填充。
 * 只放"现在确实有消费者"的参数（YAGNI）；V3 工具调用 / V5 实体抽取
 * 需要 JSON 模式时再加 responseFormat。
 */
export interface ChatRequest {
  model: string; // 模型名（来自 models.modelName，如 qwen-plus）
  messages: ChatMessage[];
  /** 是否流式；默认 false。Chat=true，Summary/自查=false */
  stream?: boolean;
  /** 客户端断开 / 超时中断。只有 Chat 需要 */
  signal?: AbortSignal;
  /** 生成控制，来自 models.config（data-driven） */
  temperature?: number;
  maxTokens?: number;
  /** ★ 模型/厂商特有扩展参数（透传）：由【调用方】在调用时传入（如 DeepSeek enable_thinking），不存 DB、接口不枚举。DB 只存大众化参数（temperature/maxTokens） */
  vendorParams?: Record<string, unknown>;
}

export interface ChatChunk {
  /** 增量文本；缺省表示该事件不含文本（如 thinking/结束） */
  delta?: string;
  /** 结束标记 */
  done: boolean;
  /** 本次增量可选的 usage 快照 */
  usage?: {
    promptTokens?: number;
    completionTokens?: number;
    totalTokens?: number;
  };
}

/**
 * 统一对话 Provider 抽象：换协议/换厂商不改业务代码。
 * 设计决策：stream() 是唯一原始方法；complete() 是它的薄包装（聚合增量），
 * 非流式场景（Summary/自查/实体抽取）直接拿整段，不维护第二套 HTTP 解析路径。
 */
export interface ChatProvider {
  readonly protocol: ChatProtocol;
  /** 流式对话，逐 chunk 产出 */
  stream(req: ChatRequest): AsyncGenerator<ChatChunk>;
  /** 非流式对话，返回完整文本（内部实现：累加 stream() 的 delta） */
  complete(
    req: ChatRequest,
  ): Promise<{ content: string; usage?: ChatChunk['usage'] }>;
}
