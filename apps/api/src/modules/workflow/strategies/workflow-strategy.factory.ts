import { Injectable } from '@nestjs/common';

@Injectable()
export class WorkflowStrategyFactory {
  private strategies = new Map<string, any>();

  register(strategy: any) {
    // if (this.strategies.has(strategy.name)) {
    //   throw new Error(`Strategy "${strategy.name}" already registered`);
    // }
    this.strategies.set(strategy, strategy);
  }
}
