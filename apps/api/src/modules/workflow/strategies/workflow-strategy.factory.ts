import {
  Injectable,
  BadRequestException,
  NotImplementedException,
} from '@nestjs/common';
import { WorkflowStrategy } from '../interface/workflow-strategy.interface';
import { WorkflowType } from '../interface/workflow.interface';

@Injectable()
export class WorkflowStrategyFactory {
  private strategies = new Map<WorkflowType, WorkflowStrategy>();

  /** 注册策略 — 在 WorkflowModule.onModuleInit() 中调用 */
  register(strategy: WorkflowStrategy): void {
    if (this.strategies.has(strategy.type)) {
      throw new Error(
        `Strategy for type "${strategy.type}" already registered`,
      );
    }
    this.strategies.set(strategy.type, strategy);
  }

  /** 按类型获取策略 */
  getStrategy(type: WorkflowType): WorkflowStrategy {
    const strategy = this.strategies.get(type);
    if (!strategy) {
      // rewoo / multi_agent / custom 未注册时统一抛 NotImplemented
      if (type === 'rewoo' || type === 'multi_agent' || type === 'custom') {
        throw new NotImplementedException(`${type} strategy is V3+`);
      }
      throw new BadRequestException(`Unknown workflow type: ${type}`);
    }
    return strategy;
  }
}
