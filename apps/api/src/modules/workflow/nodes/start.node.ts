import { Injectable } from '@nestjs/common';
import { NodeContext, GraphNode } from '../interface/node.interface';
import { AgentState } from '../interface/state.interface';

@Injectable()
export class StartNode implements GraphNode {
  readonly type = 'start';
  readonly label = 'Start';

  // eslint-disable-next-line @typescript-eslint/require-await
  async execute(ctx: NodeContext): Promise<Partial<AgentState>> {
    return { ...ctx.state };
  }
}
