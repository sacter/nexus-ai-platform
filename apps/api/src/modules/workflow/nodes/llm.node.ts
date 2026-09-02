import { Injectable } from '@nestjs/common';
import { BaseMessage, AIMessage } from '@langchain/core/messages';
import { ModelCallerService } from '../../model/model-caller.service';
import { NodeContext, GraphNode } from '../interface/node.interface';
import { AgentState } from '../interface/state.interface';
import { ChatMessage } from '@nexus/ai-core';

@Injectable()
export class LlmNode implements GraphNode {
  readonly type = 'llm';
  readonly label = 'LLM';

  constructor(private readonly modelCallerService: ModelCallerService) {}

  async execute(ctx: NodeContext): Promise<Partial<AgentState>> {
    const modelId =
      ctx.state.modelId ??
      (ctx.config?.configurable as { modelId: string } | undefined)?.modelId;
    const temperature =
      (ctx.config?.configurable as { temperature: number } | undefined)
        ?.temperature ?? 0.7;

    if (!modelId) {
      return { error: 'No modelId provided' };
    }

    const { client, modelName, baseConfig } =
      await this.modelCallerService.resolveChatModel(modelId);

    // 将 BaseMessage[] 转为 ChatMessage[]（{ role, content }）
    const rawMessages = ctx.state.messages ?? [];
    const messages: ChatMessage[] = rawMessages.map((m: BaseMessage) => ({
      role: this.toChatRole(m),
      content:
        typeof m.content === 'string' ? m.content : JSON.stringify(m.content),
    }));

    const response = await client.complete({
      model: modelName,
      messages,
      temperature: temperature ?? baseConfig.temperature,
      maxTokens: baseConfig.maxTokens ?? 4096,
    });

    return {
      messages: [new AIMessage({ content: response.content })],
    };
  }

  /** BaseMessage._getType() → ChatRole */
  private toChatRole(m: BaseMessage): 'system' | 'user' | 'assistant' {
    const t = m._getType();
    if (t === 'human') return 'user';
    if (t === 'ai') return 'assistant';
    return 'system'; // 'system' / 'generic' / 其他默认 system
  }
}
