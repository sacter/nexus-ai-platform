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
      // password: process.env.REDIS_PASSWORD,
      // db: Number(process.env.REDIS_DB ?? 0),
      lazyConnect: true,
      maxRetriesPerRequest: null, // BullMQ 要求 null
      enableReadyCheck: false,
    });

    // 关键：监听错误，防止进程直接crash
    this.client.on('error', (err) => {
      this.logger.error(`Redis client error`, err);
    });
    this.client.on('ready', () => {
      this.logger.log('Redis client ready');
    });
    this.client.on('close', () => {
      this.logger.warn('Redis connection closed');
    });
    this.client.on('reconnecting', (delay) => {
      this.logger.debug(`Redis reconnecting, delay:${delay}ms`);
    });

    try {
      await this.client.connect();
      this.logger.log('Redis connected success');
    } catch (error) {
      this.logger.error('Redis connection faild', error);
      // 如果希望redis断开允许应用继续启动，注释下面这行，ioredis会后台自动重连
      // throw error;
    }
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
