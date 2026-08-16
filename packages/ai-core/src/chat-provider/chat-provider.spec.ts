import {
  ChatProtocol,
  ChatRequest,
  createChatProvider,
  OpenAiCompatibleChatClient,
  OllamaNativeChatClient,
} from './index.js';

/** 构造一个可读的流式 Response（SSE 或 JSON-lines 由 payload 决定） */
function streamResponse(payload: string): Response {
  const bytes = new TextEncoder().encode(payload);
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(bytes);
      controller.close();
    },
  });
  return {
    ok: true,
    status: 200,
    body,
    json: async () => {
      throw new Error('stream response has no json');
    },
    text: async () => payload,
  } as unknown as Response;
}

/** 构造非流式 JSON Response */
function jsonResponse(data: unknown): Response {
  return {
    ok: true,
    status: 200,
    body: null,
    json: async () => data,
    text: async () => JSON.stringify(data),
  } as unknown as Response;
}

/** 抓取最近一次 fetch 调用的请求体 */
function captureBody(fetchMock: jest.Mock): Record<string, unknown> {
  const [, init] = fetchMock.mock.calls.at(-1) as [string, RequestInit];
  return JSON.parse(init.body as string) as Record<string, unknown>;
}

function captureUrl(fetchMock: jest.Mock): string {
  const [url] = fetchMock.mock.calls.at(-1) as [string, RequestInit];
  return url;
}

function captureSignal(fetchMock: jest.Mock): unknown {
  const [, init] = fetchMock.mock.calls.at(-1) as [string, RequestInit];
  return init.signal;
}

const originalFetch = global.fetch;

describe('OpenAiCompatibleChatClient（默认协议）', () => {
  let fetchMock: jest.Mock;

  beforeEach(() => {
    fetchMock = jest.fn();
    global.fetch = fetchMock as unknown as typeof fetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  const client = new OpenAiCompatibleChatClient({
    baseUrl: 'https://dashscope.example.com/v1/',
    apiKey: 'sk-test',
  });

  it('非流式：complete() 返回整段内容并归一化 usage', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        choices: [{ message: { content: '你好，我是 NexusAI' } }],
        usage: { prompt_tokens: 12, completion_tokens: 8, total_tokens: 20 },
      }),
    );

    const { content, usage } = await client.complete({
      model: 'qwen-plus',
      messages: [{ role: 'user', content: 'hi' }],
    });

    expect(content).toBe('你好，我是 NexusAI');
    expect(usage).toEqual({
      promptTokens: 12,
      completionTokens: 8,
      totalTokens: 20,
    });
    expect(captureUrl(fetchMock)).toBe(
      'https://dashscope.example.com/v1/chat/completions',
    );
    const body = captureBody(fetchMock);
    expect(body.stream).toBe(false);
    expect(body.model).toBe('qwen-plus');
    expect(body.messages).toEqual([{ role: 'user', content: 'hi' }]);
  });

  it('流式：SSE 逐 delta 产出，complete() 聚合成完整文本', async () => {
    fetchMock.mockResolvedValueOnce(
      streamResponse(
        [
          'data: {"choices":[{"delta":{"content":"你"}}]}',
          '',
          'data: {"choices":[{"delta":{"content":"好"}}]}',
          '',
          'data: {"choices":[],"usage":{"prompt_tokens":10,"completion_tokens":2,"total_tokens":12}}',
          '',
          'data: [DONE]',
          '',
        ].join('\n'),
      ),
    );

    const chunks: string[] = [];
    let usage;
    let sawDone = false;
    for await (const chunk of client.stream({
      model: 'qwen-plus',
      messages: [{ role: 'user', content: 'hi' }],
      stream: true,
    })) {
      if (chunk.delta) chunks.push(chunk.delta);
      if (chunk.usage) usage = chunk.usage;
      if (chunk.done) sawDone = true;
    }

    expect(chunks.join('')).toBe('你好');
    expect(usage).toEqual({
      promptTokens: 10,
      completionTokens: 2,
      totalTokens: 12,
    });
    expect(sawDone).toBe(true);
    expect(captureBody(fetchMock).stream).toBe(true);
  });

  it('vendorParams 透传进请求体，显式字段优先于 vendorParams', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ choices: [{ message: { content: 'ok' } }] }),
    );

    await client.complete({
      model: 'deepseek-chat',
      messages: [{ role: 'user', content: '关闭思考' }],
      // ★ 由调用方在调用时传入，不落 DB
      vendorParams: { enable_thinking: false, temperature: 999 },
      temperature: 0.5,
      maxTokens: 128,
    });

    const body = captureBody(fetchMock);
    expect(body.enable_thinking).toBe(false);
    expect(body.temperature).toBe(0.5); // 显式字段覆盖 vendorParams
    expect(body.max_tokens).toBe(128);
  });

  it('AbortSignal 透传给 fetch', async () => {
    const controller = new AbortController();
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ choices: [{ message: { content: 'ok' } }] }),
    );

    await client.complete({
      model: 'qwen-plus',
      messages: [{ role: 'user', content: 'hi' }],
      signal: controller.signal,
    });

    expect(captureSignal(fetchMock)).toBe(controller.signal);
  });

  it('上游 HTTP 错误抛异常并带出状态码', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 429,
      body: null,
      json: async () => ({}),
      text: async () => 'rate limited',
    } as unknown as Response);

    await expect(
      client.complete({ model: 'qwen-plus', messages: [] }),
    ).rejects.toThrow(/HTTP 429/);
  });
});

describe('OllamaNativeChatClient（可选协议）', () => {
  let fetchMock: jest.Mock;

  beforeEach(() => {
    fetchMock = jest.fn();
    global.fetch = fetchMock as unknown as typeof fetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  const client = new OllamaNativeChatClient({ baseUrl: 'http://localhost:11434/' });

  it('请求体：temperature→options.temperature，maxTokens→options.num_predict，vendorParams 顶层透传', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ message: { content: 'hi' }, done: true }),
    );

    await client.complete({
      model: 'qwen2.5',
      messages: [{ role: 'user', content: 'hi' }],
      temperature: 0.7,
      maxTokens: 256,
      vendorParams: { format: 'json', options: { num_ctx: 4096 } },
    });

    expect(captureUrl(fetchMock)).toBe('http://localhost:11434/api/chat');
    const body = captureBody(fetchMock);
    expect(body.options).toEqual({ num_ctx: 4096, temperature: 0.7, num_predict: 256 });
    expect(body.format).toBe('json');
    expect(body.messages).toEqual([{ role: 'user', content: 'hi' }]);
  });

  it('流式：JSON-lines 行解析 + 结束行 usage 归一化', async () => {
    fetchMock.mockResolvedValueOnce(
      streamResponse(
        [
          '{"message":{"role":"assistant","content":"你"},"done":false}',
          '{"message":{"role":"assistant","content":"好"},"done":false}',
          '{"done":true,"eval_count":2,"prompt_eval_count":10}',
          '',
        ].join('\n'),
      ),
    );

    const chunks: string[] = [];
    let usage;
    for await (const chunk of client.stream({
      model: 'qwen2.5',
      messages: [{ role: 'user', content: 'hi' }],
      stream: true,
    })) {
      if (chunk.delta) chunks.push(chunk.delta);
      if (chunk.usage) usage = chunk.usage;
    }

    expect(chunks.join('')).toBe('你好');
    expect(usage).toEqual({
      promptTokens: 10,
      completionTokens: 2,
      totalTokens: 12,
    });
  });
});

describe('createChatProvider 工厂', () => {
  it('缺省 protocol → OpenAI 兼容 client', () => {
    const provider = createChatProvider({
      baseUrl: 'https://example.com/v1',
    });
    expect(provider).toBeInstanceOf(OpenAiCompatibleChatClient);
    expect(provider.protocol).toBe('openai-compatible');
  });

  it('ollama-native → Ollama 原生 client', () => {
    const provider = createChatProvider({
      protocol: 'ollama-native',
      baseUrl: 'http://localhost:11434',
    });
    expect(provider).toBeInstanceOf(OllamaNativeChatClient);
    expect(provider.protocol).toBe('ollama-native');
  });

  it('未知协议名 → 兜底 OpenAI 兼容（不写死厂商的扩展性）', () => {
    const provider = createChatProvider({
      protocol: 'some-future-protocol' as unknown as ChatProtocol,
      baseUrl: 'https://example.com/v1',
    });
    expect(provider).toBeInstanceOf(OpenAiCompatibleChatClient);
  });
});
