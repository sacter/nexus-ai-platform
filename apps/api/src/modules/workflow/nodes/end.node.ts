import { Injectable } from '@nestjs/common';
import { GraphNode } from '../interface/node.interface';
import { AgentState } from '../interface/state.interface';

@Injectable()
export class EndNode implements GraphNode {
  readonly type = 'end';
  readonly label = 'End';

  // eslint-disable-next-line @typescript-eslint/require-await
  async execute(): Promise<Partial<AgentState>> {
    // 结束节点：聚合最终输出，无需额外操作
    return {};
  }
}
