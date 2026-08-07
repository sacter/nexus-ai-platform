import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Queue } from 'bullmq';
import Redis from 'ioredis';
import { QUEUE_CONCURRENCY, QueueName } from './queue.constants';

/**
 * BullMQ 队列生产者管理
 *
 * - 共享一个 Redis 连接（maxRetriesPerRequest: null 为 BullMQ 必需）
 * - getQueue(name) 懒创建并缓存 Queue 实例
 * - 默认重试策略：指数退避，最多 3 次
 */
@Injectable()
export class QueueService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(QueueService.name);
  private connection!: Redis;
  private readonly queues = new Map<string, Queue>();

  async onModuleInit() {
    this.connection = new Redis({
      host: process.env.REDIS_HOST ?? 'localhost',
      port: parseInt(process.env.REDIS_PORT ?? '6379', 10),
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
    });
    this.logger.log('BullMQ connection ready');
  }

  async onModuleDestroy() {
    await Promise.all([...this.queues.values()].map((q) => q.close()));
    await this.connection?.quit();
  }

  getQueue(name: QueueName): Queue {
    let queue = this.queues.get(name);
    if (!queue) {
      queue = new Queue(name, {
        connection: this.connection,
        defaultJobOptions: {
          attempts: 3,
          backoff: { type: 'exponential', delay: 2000 },
          removeOnComplete: 100,
          removeOnFail: 500,
        },
      });
      this.queues.set(name, queue);
      this.logger.log(`Queue "${name}" created (concurrency=${QUEUE_CONCURRENCY[name]})`);
    }
    return queue;
  }

  /** 入队辅助 */
  async add(name: QueueName, jobName: string, data: unknown) {
    return this.getQueue(name).add(jobName, data);
  }
}
