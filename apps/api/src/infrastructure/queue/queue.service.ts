import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { Queue } from 'bullmq';
import { RedisService } from '../redis/redis.service';
import { QUEUE_CONCURRENCY, QueueName } from './queue.constants';

/**
 * BullMQ 队列生产者管理
 *
 * - 复用 RedisService 的共享连接（单例，maxRetriesPerRequest: null 为 BullMQ 必需）
 * - getQueue(name) 懒创建并缓存 Queue 实例
 * - 默认重试策略：指数退避，最多 3 次
 */
@Injectable()
export class QueueService implements OnModuleDestroy {
  private readonly logger = new Logger(QueueService.name);
  private readonly queues = new Map<string, Queue>();

  constructor(private readonly redis: RedisService) {}

  async onModuleDestroy() {
    await Promise.all([...this.queues.values()].map((q) => q.close()));
  }

  getQueue(name: QueueName): Queue {
    let queue = this.queues.get(name);
    if (!queue) {
      queue = new Queue(name, {
        connection: this.redis.getClient(),
        defaultJobOptions: {
          attempts: 3,
          backoff: { type: 'exponential', delay: 2000 },
          removeOnComplete: 100,
          removeOnFail: 500,
        },
      });
      this.queues.set(name, queue);
      this.logger.log(
        `Queue "${name}" created (concurrency=${QUEUE_CONCURRENCY[name]})`,
      );
    }
    return queue;
  }

  /** 入队辅助 */
  async add(name: QueueName, jobName: string, data: unknown) {
    return this.getQueue(name).add(jobName, data);
  }
}
