import { Injectable, Logger } from '@nestjs/common';
import { ModelCallerService } from '../../model/model-caller.service';
import { NodeContext, GraphNode } from '../interface/node.interface';
import { AgentState } from '../interface/state.interface';

@Injectable()
export class RouterNode implements GraphNode {
  readonly type = 'router';
  readonly label = 'Query Router';

  private readonly logger = new Logger(RouterNode.name);

  constructor(private readonly modelCallerService: ModelCallerService) {}

  async execute(ctx: NodeContext): Promise<Partial<AgentState>> {
    const lastMessage = ctx.state.messages?.at(-1) as
      { content: string } | undefined;
    const query = lastMessage?.content ?? '';

    // 如果没有 kbId，直接走 direct_answer，无需 LLM 判断
    if (!ctx.state.kbId && !ctx.config?.configurable?.kbId) {
      this.logger.debug('No kbId available, routing to direct_answer');
      return { routerDecision: 'direct_answer' };
    }

    const modelId =
      ctx.state.modelId ??
      (ctx.config?.configurable as { modelId?: string } | undefined)?.modelId;

    if (!modelId) {
      this.logger.warn('No modelId available, defaulting to retrieve');
      return { routerDecision: 'retrieve' };
    }

    try {
      const { client, modelName } =
        await this.modelCallerService.resolveChatModel(modelId);

      const response = await client.complete({
        model: modelName,
        messages: [
          {
            role: 'system',
            content: `你是一个查询分类器。判断用户问题是否需要检索知识库才能回答。
                      规则：
                      - 如果问题涉及专业知识、事实查询、引用资料、文档内容 → 输出 "retrieve"
                      - 如果问题属于闲聊、简单常识、问候、翻译、无需外部知识 → 输出 "direct_answer"
                      只输出一个词，不要任何解释。`,
          },
          { role: 'user', content: query },
        ],
        temperature: 0,
        maxTokens: 10,
      });

      const decision = response.content?.trim().toLowerCase();
      const routerDecision =
        decision === 'retrieve' ? 'retrieve' : 'direct_answer';

      this.logger.debug(
        `Router decision: ${routerDecision} (raw: ${decision})`,
      );
      return { routerDecision };
    } catch (err) {
      this.logger.warn(
        `Router LLM call failed, defaulting to retrieve: ${(err as Error).message}`,
      );
      // 兜底：走检索更安全
      return { routerDecision: 'retrieve' };
    }
  }
}
