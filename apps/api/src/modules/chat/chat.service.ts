import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '@nexus/database';
import { RetrievalService } from '../retrieval/retrieval.service';
import { ModelCallerService } from '../model/model-caller.service';
import { SessionLockService } from '../../common/services/session-lock.service';
import type { Prisma } from '@prisma/client';
import type {
  ChatStreamEvent,
  CitationDto,
  TokenUsage,
} from './chat-stream.types';
import { TooManyRequestsException } from '../../common/exceptions/too‑many‑requests.exception';

const DEFAULT_SYSTEM_PROMPT =
  '你是智能知识助手。仅依据提供的知识库上下文回答；上下文无相关信息时明确说明。引用来源用 [1]、[2] 编号标注。';
/** 历史消息条数上限（再按 token 预算裁剪） */
const HISTORY_LIMIT = 20;
/** 历史消息 token 预算（粗略估算，超出从最旧开始丢弃） */
const HISTORY_TOKEN_BUDGET = 1500;
/** 粗略估算：1 token ≈ 4 字符（中英混合的保守值） */
const CHARS_PER_TOKEN = 4;
/** 会话锁 TTL：流式生成可能超过默认 30s，放宽到 5 分钟 */
const LOCK_TTL_MS = 5 * 60_000;

@Injectable()
export class ChatService {
  private readonly logger = new Logger(ChatService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly retrieval: RetrievalService,
    private readonly modelCaller: ModelCallerService,
    private readonly sessionLock: SessionLockService,
  ) {}

  // POST /chat/sessions/:id/messages —— 前置：只取会话锁。
  // 必须在写 SSE 头前调用：锁被占用抛 429（TooManyRequestsException → HttpExceptionFilter 返回 HTTP 状态码）；
  // 目标解析/流内错误由 streamMessage 发 {type:'error'} 事件兜底，不走 HTTP。
  async prepare(id: string): Promise<void> {
    const acquired = await this.sessionLock.acquire(id, LOCK_TTL_MS);
    if (!acquired) {
      throw new TooManyRequestsException('会话处理中，请稍候');
    }
  }

  // POST /chat/sessions/:id/messages —— SSE 流式管线（@Sse 消费）。
  // 顺序：解析目标(kbId/模型/系统提示词) → 落库用户消息 → 检索(失败降级纯 LLM) →
  // 组装 system(检索结果+引用标注)+历史 → provider.stream 推 delta → 落库助手消息 → done。
  // 任一步非 abort 失败 → 发 {type:'error'} 事件；finally 释放锁。
  async *streamMessage(
    sessionId: string,
    userId: string,
    content: string,
    signal?: AbortSignal,
  ): AsyncGenerator<ChatStreamEvent> {
    try {
      // ① 解析会话目标：归属校验 + kbId + 模型 + 系统提示词。失败抛错 → catch 发 error 事件兜底
      const target = await this.resolveTarget(sessionId, userId);
      // 目标有效后落库用户消息（即使后续流中断也保留）
      await this.prisma.chatMessage.create({
        data: { sessionId, role: 'user', content },
      });

      // ② 检索上下文（失败不阻断，降级为纯 LLM）
      yield {
        type: 'step',
        data: { step: 'retrieval', message: '正在检索知识库…' },
      };
      const citations = await this.searchContext(content, target.kbId);
      yield { type: 'citations', data: citations };

      // ③ 组装 messages：system（检索结果 + 角色设定 + 引用标注）+ 预算内历史 + 当前提问
      yield {
        type: 'step',
        data: { step: 'generating', message: '正在生成回答…' },
      };
      const history = await this.loadHistory(sessionId);
      const messages = [
        {
          role: 'system' as const,
          content: this.buildSystemPrompt(
            target.systemPrompt,
            citations,
            content,
            history,
          ),
        },
        ...history,
        { role: 'user' as const, content },
      ];

      // ④ 模型流式生成（signal 由 controller 在客户端断开/stop 时 abort）
      const { client, modelName, baseConfig } = target.model;
      let answer = '';
      let usage: TokenUsage | undefined;
      for await (const chunk of client.stream({
        model: modelName,
        messages,
        stream: true,
        signal,
        ...baseConfig,
      })) {
        if (signal?.aborted) return;
        if (chunk.delta) {
          answer += chunk.delta;
          yield { type: 'delta', data: { content: chunk.delta } };
        }
        if (chunk.usage) {
          usage = {
            promptTokens: chunk.usage.promptTokens,
            completionTokens: chunk.usage.completionTokens,
            totalTokens: chunk.usage.totalTokens,
          };
        }
        if (chunk.done) break;
      }

      // ⑤ 完成落库助手消息（content + citations JSONB + tokens）
      const assistant = await this.prisma.chatMessage.create({
        data: {
          sessionId,
          role: 'assistant',
          content: answer,
          citations: citations as unknown as Prisma.InputJsonValue,
          promptTokens: usage?.promptTokens ?? 0,
          completionTokens: usage?.completionTokens ?? 0,
          totalTokens: usage?.totalTokens ?? 0,
          metadata: { model: modelName },
        },
      });

      // ⑥ done（前端收到后重拉历史：此时 user/assistant 均已落库）
      yield {
        type: 'done',
        data: { messageId: assistant.id, usage, citations },
      };
    } catch (err) {
      // 客户端断开/超时：静默结束，不打扰已断开的连接
      if (signal?.aborted || (err as Error)?.name === 'AbortError') return;
      this.logger.error(
        `chat streamMessage 失败: ${(err as Error)?.message}`,
        (err as Error)?.stack,
      );
      yield {
        type: 'error',
        data: { message: (err as Error)?.message ?? '生成失败' },
      };
    } finally {
      await this.sessionLock.release(sessionId).catch(() => {});
    }
  }

  /** 解析会话目标：归属校验 + kbId + 模型 + 系统提示词。任一失败抛错 → 上层发 error 事件 */
  private async resolveTarget(sessionId: string, userId: string) {
    const session = await this.prisma.chatSession.findFirst({
      where: { id: sessionId, userId },
      select: {
        id: true,
        kbId: true,
        modelId: true,
        promptTemplateId: true,
        aiApplicationId: true,
      },
    });
    if (!session) throw new BadRequestException('会话不存在');

    // 旧会话兼容：会话自身缺 modelId/kbId 且带 aiApplicationId → 回退 AI 应用解析
    let app:
      | {
          modelId: string;
          promptTemplateId: string | null;
          knowledgeBaseId: string | null;
        }
      | null = null;
    if ((!session.modelId || !session.kbId) && session.aiApplicationId) {
      app = await this.prisma.aiApplication.findUnique({
        where: { id: session.aiApplicationId },
        select: { modelId: true, promptTemplateId: true, knowledgeBaseId: true },
      });
      if (!app) throw new BadRequestException('AI 应用不存在');
    }

    const modelId = session.modelId ?? app?.modelId;
    if (!modelId) throw new BadRequestException('会话未配置模型');

    // kbId 优先会话自身的，其次应用默认知识库
    const kbId = session.kbId ?? app?.knowledgeBaseId;
    if (!kbId) throw new BadRequestException('会话未配置知识库');

    const model = await this.modelCaller.resolveChatModel(modelId);
    const systemPrompt = await this.resolveSystemPrompt(
      session.promptTemplateId ?? app?.promptTemplateId,
    );
    return { kbId, model, systemPrompt };
  }

  /** 检索上下文；失败降级为空（纯 LLM），不阻断生成 */
  private async searchContext(
    query: string,
    kbId: string,
  ): Promise<CitationDto[]> {
    try {
      const search = await this.retrieval.search({
        query,
        kbId,
        strategy: 'vector',
      });
      return search.results.map((r) => ({
        documentName: r.documentName,
        page: r.page,
        snippet: r.citation?.snippet,
        score: r.score,
        chunkId: r.chunkId,
      }));
    } catch (err) {
      this.logger.warn(`检索失败，降级为纯 LLM：${(err as Error)?.message}`);
      return [];
    }
  }

  /** 最近历史：从最新往回按 token 预算累计，超预算丢弃更旧的 */
  private async loadHistory(
    sessionId: string,
  ): Promise<{ role: 'user' | 'assistant'; content: string }[]> {
    const recent = await this.prisma.chatMessage.findMany({
      where: { sessionId },
      orderBy: { createdAt: 'desc' },
      take: HISTORY_LIMIT,
      select: { role: true, content: true },
    });
    const kept: { role: 'user' | 'assistant'; content: string }[] = [];
    let tokens = 0;
    for (const m of recent) {
      if (m.role === 'system') continue;
      const t = Math.ceil(m.content.length / CHARS_PER_TOKEN);
      if (tokens + t > HISTORY_TOKEN_BUDGET) break;
      tokens += t;
      kept.push({ role: m.role, content: m.content });
    }
    return kept.reverse();
  }

  /** system 消息 = 角色设定 + 检索结果（[编号] 引用标注）。模板含占位符则渲染，否则直接拼接 */
  private buildSystemPrompt(
    basePrompt: string,
    citations: CitationDto[],
    question: string,
    history: { role: 'user' | 'assistant'; content: string }[],
  ): string {
    const contextBlock = this.renderContextBlock(citations);
    if (basePrompt.includes('{{')) {
      return basePrompt
        .replace(/\{\{context\}\}/g, contextBlock)
        .replace(/\{\{question\}\}/g, question)
        .replace(
          /\{\{history\}\}/g,
          history.map((h) => `${h.role}: ${h.content}`).join('\n'),
        );
    }
    return `${basePrompt}\n\n${contextBlock}`;
  }

  private renderContextBlock(citations: CitationDto[]): string {
    if (!citations.length) return '（本次检索未命中知识库内容，请勿虚构引用）';
    return (
      '【知识库上下文，回答时引用请用 [编号] 标注】\n' +
      citations
        .map(
          (c, i) =>
            `[${i + 1}] 《${c.documentName}》${c.page ? ` 第${c.page}页` : ''}：${c.snippet ?? ''}`,
        )
        .join('\n')
    );
  }

  private async resolveSystemPrompt(
    promptTemplateId: string | null,
  ): Promise<string> {
    if (!promptTemplateId) return DEFAULT_SYSTEM_PROMPT;
    const template = await this.prisma.promptTemplate.findUnique({
      where: { id: promptTemplateId },
      select: { currentVersionId: true },
    });
    if (!template?.currentVersionId) return DEFAULT_SYSTEM_PROMPT;
    const version = await this.prisma.promptTemplateVersion.findUnique({
      where: { id: template.currentVersionId },
      select: { content: true },
    });
    return version?.content || DEFAULT_SYSTEM_PROMPT;
  }
}
