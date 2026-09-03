import { Injectable } from '@nestjs/common';
import { WorkflowStrategy } from '../interface/workflow-strategy.interface';

@Injectable()
export class RewooStrategy implements WorkflowStrategy {
  readonly type = 'rewoo';

  async *run() {
    /// todo
  }
}
