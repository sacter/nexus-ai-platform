import { Injectable } from '@nestjs/common';
import { RedisService } from '../infrastructure/redis/redis.service';

/**
 * Session 分布式锁 —— 设计文档 2bis.2
 *
 * 同一 Session 同一时间只允许一个 LLM 请求：
 * 用户快速连点发送按钮 → 第二个请求 acquire 失败 → 返回 HTTP 429
 */
@Injectable()
export class SessionLockService {
  private static readonly KEY_PREFIX = 'lock:session:';
  private static readonly DEFAULT_TTL_MS = 30_000;

  constructor(private readonly redis: RedisService) {}

  /** 获取锁，成功返回 true；已被持有返回 false */
  async acquire(sessionId: string, ttlMs = SessionLockService.DEFAULT_TTL_MS): Promise<boolean> {
    return this.redis.acquireLock(`${SessionLockService.KEY_PREFIX}${sessionId}`, ttlMs);
  }

  /** 释放锁 */
  async release(sessionId: string): Promise<void> {
    await this.redis.releaseLock(`${SessionLockService.KEY_PREFIX}${sessionId}`);
  }
}
