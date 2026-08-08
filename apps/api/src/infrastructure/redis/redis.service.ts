import {
  Injectable,
  Logger,
  OnApplicationShutdown,
  OnModuleInit,
} from '@nestjs/common';
import Redis from 'ioredis';

/**
 * Redis 服务（缓存 + 分布式锁）
 *
 * - 唯一 Redis 连接持有者：QueueService 与全部 BullMQ Worker 通过 getClient() 复用
 * - get/set：带 TTL 的通用缓存（embedding 缓存、检索缓存）
 * - acquireLock/releaseLock：SET NX EX 实现分布式锁（Session 锁）
 * - maxRetriesPerRequest: null 为 BullMQ 必需
 */
@Injectable()
export class RedisService implements OnModuleInit, OnApplicationShutdown {
  private readonly logger = new Logger(RedisService.name);
  private client!: Redis;

  async onModuleInit() {
    this.client = new Redis({
      host: process.env.REDIS_HOST ?? 'localhost',
      port: parseInt(process.env.REDIS_PORT ?? '6379', 10),
      lazyConnect: true,
      maxRetriesPerRequest: null, // BullMQ 要求 null
      enableReadyCheck: false,
    });
    await this.client.connect();
    this.logger.log('Redis connected');
  }

  /** 在所有 onModuleDestroy（Worker/Queue 关闭）之后才 quit 共享连接 */
  async onApplicationShutdown() {
    await this.client?.quit();
  }

  getClient(): Redis {
    return this.client;
  }

  async get(key: string): Promise<string | null> {
    return this.client.get(key);
  }

  async set(key: string, value: string, ttlSeconds?: number): Promise<void> {
    if (ttlSeconds) {
      await this.client.set(key, value, 'EX', ttlSeconds);
    } else {
      await this.client.set(key, value);
    }
  }

  async del(key: string): Promise<void> {
    await this.client.del(key);
  }

  /**
   * 获取分布式锁（SET key 1 EX ttlSeconds NX）
   * 返回 true 表示获取成功，false 表示已被持有
   */
  async acquireLock(key: string, ttlMs = 30000): Promise<boolean> {
    const result = await this.client.set(
      key,
      '1',
      'EX',
      Math.floor(ttlMs / 1000),
      'NX',
    );
    return result === 'OK';
  }

  /** 释放分布式锁 */
  async releaseLock(key: string): Promise<void> {
    await this.client.del(key);
  }
}
