import { Injectable } from '@nestjs/common';
import { WorkflowStrategy } from '../interface/workflow-strategy.interface';

@Injectable()
export class MultiAgentStrategy implements WorkflowStrategy {
  readonly type = 'multi_agent';

  async *run() {
    /// todo
  }
}
