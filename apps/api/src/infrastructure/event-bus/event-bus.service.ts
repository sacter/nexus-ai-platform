import { Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';

/**
 * 事件总线 —— 主进程发布事件，Worker 消费者订阅
 *
 * - emit：异步发布并聚合各 listener 返回值（Worker 内 await）
 * - emitSync：同步发布（同一事件循环内触发）
 */
@Injectable()
export class EventBusService {
  constructor(private readonly eventEmitter: EventEmitter2) {}

  async emit(event: string, payload: unknown): Promise<boolean> {
    const results = await this.eventEmitter.emitAsync(event, payload);
    return results.every((r) => r !== false);
  }

  emitSync(event: string, payload: unknown): boolean {
    return this.eventEmitter.emit(event, payload);
  }
}
