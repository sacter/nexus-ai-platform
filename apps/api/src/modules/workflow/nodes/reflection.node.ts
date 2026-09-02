import { Injectable, Logger } from '@nestjs/common';
import { ModelCallerService } from '../../model/model-caller.service';
import { NodeContext, GraphNode } from '../interface/node.interface';
import { AgentState } from '../interface/state.interface';

@Injectable()
export class ReflectionNode implements GraphNode {
  readonly type = 'reflection';
  readonly label = 'Reflection Judge';
  private readonly logger = new Logger(ReflectionNode.name);

  constructor(private readonly modelCallerService: ModelCallerService) {}

  // eslint-disable-next-line @typescript-eslint/require-await
  async execute(ctx: NodeContext): Promise<Partial<AgentState>> {
    const lastMessage =
      (ctx.state.messages?.at(-1) as { content: string } | undefined)
        ?.content ?? '';
    const iteration = (ctx.state.iteration ?? 0) + 1;

    // 使用简单规则判断质量（可替换为 LLM judge）
    const needsImprovement =
      lastMessage.length < 20 || lastMessage.includes('不确定');
    const judgeResult = needsImprovement ? 'needs_improvement' : 'approved';

    return {
      iteration,
      needsImprovement,
      judgeResult,
    };
  }
}
