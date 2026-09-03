import { Injectable } from '@nestjs/common';
import { WorkflowStrategy } from '../interface/workflow-strategy.interface';

@Injectable()
export class ReflectionStrategy implements WorkflowStrategy {
  readonly type = 'reflection';

  async *run() {
    /// todo
  }
}
