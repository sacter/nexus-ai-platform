import { Injectable } from '@nestjs/common';
import { GraphNode } from '../interface/node.interface';
import { AgentState } from '../interface/state.interface';

@Injectable()
export class ConditionNode implements GraphNode {
  readonly type = 'condition';
  readonly label = 'Condition';

  // eslint-disable-next-line @typescript-eslint/require-await
  async execute(): Promise<Partial<AgentState>> {
    // 条件节点由 addConditionalEdges 的路由函数处理，
    // 此处仅作占位节点，实际路由逻辑在策略的条件边中定义
    return {};
  }
}
