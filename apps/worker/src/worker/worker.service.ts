import { Injectable, Logger } from '@nestjs/common';
import { RedisService } from '@nexus/shared';
import { QUEUE_NAMES } from '@nexus/shared';

/**
 * Worker 服务 —— 状态上报与健康检查
 */
@Injectable()
export class WorkerService {
  private readonly logger = new Logger(WorkerService.name);

  constructor(private readonly redis: RedisService) {}

  health() {
    const redisStatus = this.redis.getClient()?.status ?? 'disconnected';
    return {
      worker: 'running',
      redis: redisStatus,
      queues: Object.values(QUEUE_NAMES),
    };
  }
}
