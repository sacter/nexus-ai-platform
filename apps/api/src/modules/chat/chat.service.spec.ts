import { PrismaService } from '@nexus/database';
import { RetrievalService } from '../retrieval/retrieval.service';
import { ModelCallerService } from '../model/model-caller.service';
import { SessionLockService } from '../../common/services/session-lock.service';
import { ChatService } from './chat.service';
import type { ResolvedChatModel } from '../model/model-caller.service';
import type { ChatStreamEvent } from './chat-stream.types';

/** 捕获 provider.stream 收到的请求，用于断言 system 消息内容 */
let capturedRequest: { messages: { role: string; content: string }[] } | undefined;

const happyStream = async function* () {
  yield { delta: '你好', done: false };
  yield {
    delta: '世界',
    done: false,
    usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
  };
  yield { done: true };
};

/** mock 一个可流式 ChatProvider（默认 happyStream，可传自定义） */
function mockModel(opts: { stream?: typeof happyStream } = {}): ResolvedChatModel {
  const stream = opts.stream ?? happyStream;
  return {
    client: {
      protocol: 'openai-compatible',
      async *stream(req) {
        capturedRequest = req;
        yield* stream();
      },
      async complete() {
        return { content: '' };
      },
    },
    modelName: 'deepseek-chat',
    baseConfig: { temperature: 0.5 },
  } as unknown as ResolvedChatModel;
}

async function drain(gen: AsyncGenerator<ChatStreamEvent>): Promise<ChatStreamEvent[]> {
  const events: ChatStreamEvent[] = [];
  for await (const ev of gen) events.push(ev);
  return events;
}

describe('ChatService', () => {
  let service: ChatService;
  let prisma: {
    chatSession: { findFirst: jest.Mock };
    aiApplication: { findUnique: jest.Mock };
    chatMessage: { findMany: jest.Mock; create: jest.Mock };
    promptTemplate: { findUnique: jest.Mock };
    promptTemplateVersion: { findUnique: jest.Mock };
  };
  let retrieval: { search: jest.Mock };
  let modelCaller: { resolveChatModel: jest.Mock };
  let sessionLock: { acquire: jest.Mock; release: jest.Mock };

  beforeEach(() => {
    capturedRequest = undefined;
    prisma = {
      chatSession: { findFirst: jest.fn() },
      aiApplication: { findUnique: jest.fn() },
      chatMessage: { findMany: jest.fn(), create: jest.fn() },
      promptTemplate: { findUnique: jest.fn() },
      promptTemplateVersion: { findUnique: jest.fn() },
    };
    retrieval = { search: jest.fn() };
    modelCaller = { resolveChatModel: jest.fn() };
    sessionLock = {
      acquire: jest.fn(),
      release: jest.fn().mockResolvedValue(undefined), // 服务里会 .catch()，必须返回 Promise
    };
    service = new ChatService(
      prisma as unknown as PrismaService,
      retrieval as unknown as RetrievalService,
      modelCaller as unknown as ModelCallerService,
      sessionLock as unknown as SessionLockService,
    );
  });

  /** 目标解析成功的默认 mock（kbId/模型/历史/落库/检索） */
  function mockTargetOk() {
    prisma.chatSession.findFirst.mockResolvedValue({
      id: 'session-1',
      kbId: 'kb-1',
      aiApplicationId: 'app-1',
    });
    prisma.aiApplication.findUnique.mockResolvedValue({
      modelId: 'model-1',
      promptTemplateId: null,
      knowledgeBaseId: 'kb-2',
    });
    modelCaller.resolveChatModel.mockResolvedValue(mockModel());
    prisma.chatMessage.findMany.mockResolvedValue([]);
    prisma.chatMessage.create.mockResolvedValue({ id: 'assistant-1' });
    retrieval.search.mockResolvedValue({
      results: [
        {
          documentName: '手册.pdf',
          page: 3,
          content: '…',
          score: 0.9,
          chunkId: 'c1',
          citation: { snippet: '片段' },
        },
      ],
      strategy: 'vector',
      totalCandidates: 1,
    });
  }

  describe('prepare', () => {
    it('成功获取锁 → resolve（TTL 5min）', async () => {
      sessionLock.acquire.mockResolvedValue(true);
      await expect(service.prepare('session-1')).resolves.toBeUndefined();
      expect(sessionLock.acquire).toHaveBeenCalledWith('session-1', 5 * 60_000);
    });

    it('锁被占用 → HTTP 429，不重复释放', async () => {
      sessionLock.acquire.mockResolvedValue(false);
      await expect(service.prepare('s')).rejects.toMatchObject({
        status: 429,
        message: '会话处理中，请稍候',
      });
      expect(sessionLock.release).not.toHaveBeenCalled();
    });
  });

  describe('streamMessage', () => {
    it('happy path：step→citations→step→delta→done，system 注入 [1] 引用，用户/助手落库，finally 释放锁', async () => {
      mockTargetOk();
      prisma.chatMessage.findMany.mockResolvedValue([{ role: 'user', content: '历史1' }]);

      const events = await drain(
        service.streamMessage('session-1', 'user-1', '你好'),
      );

      expect(events.map((e) => e.type)).toEqual([
        'step',
        'citations',
        'step',
        'delta',
        'delta',
        'done',
      ]);
      expect(events[1]).toEqual({
        type: 'citations',
        data: [
          {
            documentName: '手册.pdf',
            page: 3,
            snippet: '片段',
            score: 0.9,
            chunkId: 'c1',
          },
        ],
      });
      const done = events[events.length - 1];
      expect(done).toMatchObject({
        type: 'done',
        data: {
          messageId: 'assistant-1',
          usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
        },
      });

      // 用户 + 助手各落库一次
      expect(prisma.chatMessage.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            sessionId: 'session-1',
            role: 'user',
            content: '你好',
          }),
        }),
      );
      expect(prisma.chatMessage.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            role: 'assistant',
            content: '你好世界',
            promptTokens: 10,
            completionTokens: 5,
            totalTokens: 15,
          }),
        }),
      );

      // system 消息 = 角色设定 + 检索上下文（[1] 引用标注），历史与当前提问都在
      expect(capturedRequest!.messages.map((m) => m.role)).toEqual([
        'system',
        'user',
        'user',
      ]);
      expect(capturedRequest!.messages[0].content).toContain('[1] 《手册.pdf》');
      expect(capturedRequest!.messages[0].content).toContain('第3页');

      expect(sessionLock.release).toHaveBeenCalledWith('session-1');
    });

    it('会话不存在 → error 事件兜底，不落库，锁释放', async () => {
      prisma.chatSession.findFirst.mockResolvedValue(null);

      const events = await drain(service.streamMessage('s', 'u', 'hi'));

      expect(events).toEqual([{ type: 'error', data: { message: '会话不存在' } }]);
      expect(prisma.chatMessage.create).not.toHaveBeenCalled();
      expect(sessionLock.release).toHaveBeenCalledWith('s');
    });

    it('会话未绑定 AI 应用 → error 事件', async () => {
      prisma.chatSession.findFirst.mockResolvedValue({
        id: 's',
        kbId: null,
        aiApplicationId: null,
      });

      const events = await drain(service.streamMessage('s', 'u', 'hi'));

      expect(events).toEqual([
        { type: 'error', data: { message: '会话未绑定 AI 应用' } },
      ]);
      expect(sessionLock.release).toHaveBeenCalledWith('s');
    });

    it('检索失败 → 降级纯 LLM：citations 空数组，仍生成 delta，无 error 事件', async () => {
      mockTargetOk();
      retrieval.search.mockRejectedValue(new Error('ES down'));

      const events = await drain(
        service.streamMessage('session-1', 'u', 'hi'),
      );

      expect(events.some((e) => e.type === 'error')).toBe(false);
      expect(events.find((e) => e.type === 'citations')).toEqual({
        type: 'citations',
        data: [],
      });
      expect(events.filter((e) => e.type === 'delta')).toHaveLength(2);
      // 降级时 system 明确提示未命中，避免模型虚构引用
      expect(capturedRequest!.messages[0].content).toContain('未命中知识库');
      expect(sessionLock.release).toHaveBeenCalledWith('session-1');
    });

    it('模板含占位符 → system 渲染 {{context}}/{{question}}', async () => {
      prisma.chatSession.findFirst.mockResolvedValue({
        id: 's',
        kbId: 'kb-1',
        aiApplicationId: 'app-1',
      });
      prisma.aiApplication.findUnique.mockResolvedValue({
        modelId: 'm',
        promptTemplateId: 'pt-1',
        knowledgeBaseId: null,
      });
      modelCaller.resolveChatModel.mockResolvedValue(mockModel());
      prisma.promptTemplate.findUnique.mockResolvedValue({
        currentVersionId: 'ptv-1',
      });
      prisma.promptTemplateVersion.findUnique.mockResolvedValue({
        content: '模板 {{context}}｜{{question}}',
      });
      prisma.chatMessage.findMany.mockResolvedValue([]);
      prisma.chatMessage.create.mockResolvedValue({ id: 'a-1' });
      retrieval.search.mockResolvedValue({
        results: [
          { documentName: '手册.pdf', content: '片段', citation: { snippet: '片段' } },
        ],
        strategy: 'vector',
        totalCandidates: 1,
      });

      await drain(service.streamMessage('s', 'u', '问题A'));

      const sys = capturedRequest!.messages[0].content;
      expect(sys).toContain('模板');
      expect(sys).toContain('[1] 《手册.pdf》');
      expect(sys).toContain('问题A');
    });

    it('模型流抛错 → error 事件，锁释放', async () => {
      mockTargetOk();
      modelCaller.resolveChatModel.mockResolvedValue(
        mockModel({
          stream: async function* () {
            throw new Error('boom');
          },
        }),
      );

      const events = await drain(service.streamMessage('session-1', 'u', 'hi'));

      expect(events[events.length - 1]).toEqual({
        type: 'error',
        data: { message: 'boom' },
      });
      expect(sessionLock.release).toHaveBeenCalledWith('session-1');
    });

    it('客户端 abort → 静默结束（无 error 事件），锁释放', async () => {
      mockTargetOk();
      modelCaller.resolveChatModel.mockResolvedValue(
        mockModel({
          stream: async function* () {
            throw Object.assign(new Error('aborted'), { name: 'AbortError' });
          },
        }),
      );
      const ac = new AbortController();
      ac.abort();

      const events = await drain(
        service.streamMessage('session-1', 'u', 'hi', ac.signal),
      );

      expect(events.some((e) => e.type === 'error')).toBe(false);
      expect(sessionLock.release).toHaveBeenCalledWith('session-1');
    });
  });
});
