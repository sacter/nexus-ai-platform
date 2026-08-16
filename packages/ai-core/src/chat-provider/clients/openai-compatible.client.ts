import {
  ChatChunk,
  ChatProtocol,
  ChatProvider,
  ChatRequest,
} from '../chat-provider.interface.js';

export interface OpenAiCompatibleChatConfig {
  baseUrl: string;
  apiKey?: string;
}

/** OpenAI 兼容协议的正常化 usage（prompt_tokens → promptTokens） */
function normalizeUsage(u?: {
  prompt_tokens?: number;
  completion_tokens?: number;
  total_tokens?: number;
}): ChatChunk['usage'] | undefined {
  if (!u) return undefined;
  return {
    promptTokens: u.prompt_tokens,
    completionTokens: u.completion_tokens,
    totalTokens: u.total_tokens,
  };
}

/**
 * OpenAI 兼容协议 Chat Client（默认协议）。
 *
 * 是"协议实现"不是"厂商实现"——baseUrl/apiKey 由 DB 提供（models.api_key.base_url），
 * DashScope 兼容模式 / DeepSeek / Kimi / 智谱 / Ollama 兼容端点均可走它，代码零厂商写死。
 *
 * 设计决策：
 * - stream() 是唯一原始方法：req.stream=true 走 SSE 逐 delta；req.stream=false 走 JSON 单条返回。
 * - complete() 是 stream() 的薄包装（聚合增量），非流式场景不维护第二套 HTTP 解析路径。
 * - vendorParams 先展开、显式字段后覆盖，模型特有参数（如 DeepSeek enable_thinking）不会冲掉通用参数。
 */
export class OpenAiCompatibleChatClient implements ChatProvider {
  readonly protocol: ChatProtocol = 'openai-compatible';
  private readonly baseUrl: string;
  private readonly apiKey?: string;

  constructor(config: OpenAiCompatibleChatConfig) {
    this.baseUrl = config.baseUrl.replace(/\/+$/, '');
    this.apiKey = config.apiKey;
  }

  async *stream(req: ChatRequest): AsyncGenerator<ChatChunk> {
    const stream = req.stream ?? false;
    const res = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(this.apiKey ? { Authorization: `Bearer ${this.apiKey}` } : {}),
      },
      signal: req.signal,
      body: JSON.stringify(this.buildBody(req, stream)),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(
        `OpenAI-compatible chat failed: HTTP ${res.status} ${text.slice(0, 200)}`,
      );
    }

    if (stream) {
      yield* this.parseSseStream(res);
    } else {
      const data = (await res.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
        usage?: {
          prompt_tokens?: number;
          completion_tokens?: number;
          total_tokens?: number;
        };
      };
      const content = data.choices?.[0]?.message?.content ?? '';
      yield {
        delta: content || undefined,
        done: true,
        usage: normalizeUsage(data.usage),
      };
    }
  }

  async complete(
    req: ChatRequest,
  ): Promise<{ content: string; usage?: ChatChunk['usage'] }> {
    let content = '';
    let usage: ChatChunk['usage'];
    for await (const chunk of this.stream(req)) {
      if (chunk.delta) content += chunk.delta;
      if (chunk.usage) usage = chunk.usage;
    }
    return { content, usage };
  }

  /** 组装请求体：先展开 vendorParams，显式字段（model/messages/temperature/max_tokens）后覆盖 */
  private buildBody(req: ChatRequest, stream: boolean): Record<string, unknown> {
    const body: Record<string, unknown> = {
      ...(req.vendorParams ?? {}),
      model: req.model,
      messages: req.messages,
      stream,
    };
    if (req.temperature !== undefined) body.temperature = req.temperature;
    if (req.maxTokens !== undefined) body.max_tokens = req.maxTokens;
    return body;
  }

  /** 解析 SSE data: 行 → ChatChunk；遇 [DONE] 结束；容错跳过无法解析的行（如 keep-alive 注释） */
  private async *parseSseStream(res: Response): AsyncGenerator<ChatChunk> {
    if (!res.body) throw new Error('upstream stream body missing');
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let usage: ChatChunk['usage'];

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      // 按行切分（SSE 用 \n 分隔，兼容 \r\n）；末尾可能是不完整行，留到下轮
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';
      for (const raw of lines) {
        const line = raw.replace(/\r$/, '');
        if (!line.startsWith('data:')) continue;
        const payload = line.slice(5).trim();
        if (!payload || payload === '[DONE]') continue;
        try {
          const json = JSON.parse(payload) as {
            choices?: Array<{ delta?: { content?: string } }>;
            usage?: {
              prompt_tokens?: number;
              completion_tokens?: number;
              total_tokens?: number;
            };
          };
          const delta = json.choices?.[0]?.delta?.content ?? '';
          if (json.usage) usage = normalizeUsage(json.usage);
          yield { delta: delta || undefined, done: false, usage };
        } catch {
          // 忽略不可解析的行，不中断流
        }
      }
    }
    yield { done: true, usage };
  }
}
