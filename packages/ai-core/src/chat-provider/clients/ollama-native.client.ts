import {
  ChatChunk,
  ChatProtocol,
  ChatProvider,
  ChatRequest,
} from '../chat-provider.interface.js';

export interface OllamaNativeChatConfig {
  baseUrl: string;
}

/**
 * Ollama 原生协议 Chat Client（可选；通常 models.provider='ollama' 时走 OpenAI 兼容端点即可）。
 *
 * 走 Ollama 原生 POST {baseUrl}/api/chat：
 * - stream:true → 每行一个 JSON（非 SSE，无 data: 前缀），message:{role,content} 归一化为 ChatChunk
 * - stream:false → 单个 JSON，message.content 即完整回答
 * - temperature → options.temperature；maxTokens → options.num_predict
 * - vendorParams 顶层透传（含 options.* 合并进 options）
 */
export class OllamaNativeChatClient implements ChatProvider {
  readonly protocol: ChatProtocol = 'ollama-native';
  private readonly baseUrl: string;

  constructor(config: OllamaNativeChatConfig) {
    this.baseUrl = config.baseUrl.replace(/\/+$/, '');
  }

  async *stream(req: ChatRequest): AsyncGenerator<ChatChunk> {
    const stream = req.stream ?? false;
    const res = await fetch(`${this.baseUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: req.signal,
      body: JSON.stringify(this.buildBody(req, stream)),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(
        `Ollama chat failed: HTTP ${res.status} ${text.slice(0, 200)}`,
      );
    }

    if (stream) {
      yield* this.parseJsonLines(res);
    } else {
      const data = (await res.json()) as {
        message?: { content?: string };
        done?: boolean;
        eval_count?: number;
        prompt_eval_count?: number;
      };
      yield {
        delta: data.message?.content || undefined,
        done: true,
        usage: this.normalizeUsage(data),
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

  /** 组装请求体：vendorParams 顶层透传；options 合并通用参数（temperature/num_predict） */
  private buildBody(req: ChatRequest, stream: boolean): Record<string, unknown> {
    const { options: vendorOptions, ...restVendor } = req.vendorParams ?? {};
    const options: Record<string, unknown> = {
      ...(vendorOptions as Record<string, unknown> | undefined),
    };
    if (req.temperature !== undefined) options.temperature = req.temperature;
    if (req.maxTokens !== undefined) options.num_predict = req.maxTokens;
    return {
      ...restVendor,
      model: req.model,
      messages: req.messages,
      stream,
      options,
    };
  }

  private normalizeUsage(data: {
    eval_count?: number;
    prompt_eval_count?: number;
  }): ChatChunk['usage'] | undefined {
    if (data.eval_count === undefined && data.prompt_eval_count === undefined) {
      return undefined;
    }
    return {
      promptTokens: data.prompt_eval_count,
      completionTokens: data.eval_count,
      totalTokens:
        data.prompt_eval_count !== undefined && data.eval_count !== undefined
          ? data.prompt_eval_count + data.eval_count
          : undefined,
    };
  }

  /** 解析 Ollama JSON-lines 流（每行一个 JSON，无 data: 前缀） */
  private async *parseJsonLines(res: Response): AsyncGenerator<ChatChunk> {
    if (!res.body) throw new Error('upstream stream body missing');
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let usage: ChatChunk['usage'];
    let emittedDone = false;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      // 按行切分；末尾可能是不完整行，留到下轮
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';
      for (const raw of lines) {
        const line = raw.trim();
        if (!line) continue;
        try {
          const json = JSON.parse(line) as {
            message?: { content?: string };
            done?: boolean;
            eval_count?: number;
            prompt_eval_count?: number;
          };
          if (json.done) {
            emittedDone = true;
            usage = this.normalizeUsage(json);
          }
          yield {
            delta: json.message?.content || undefined,
            done: json.done ?? false,
            usage,
          };
        } catch {
          // 忽略不可解析行，不中断流
        }
      }
    }
    // 兜底结束标记（上游没发 done:true 行时）
    if (!emittedDone) yield { done: true, usage };
  }
}
