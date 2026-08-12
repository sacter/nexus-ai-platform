import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { BullModule } from '@nestjs/bullmq';
import { resolve } from 'path';
import { PrismaModule } from './infrastructure/database/prisma/prisma.module';
import { MinioModule } from './infrastructure/minio/minio.module';
import { RedisModule } from './infrastructure/redis/redis.module';
import { ModelProviderModule } from './modules/model-provider/model-provider.module';
import { EmbeddingModule } from './modules/embedding/embedding.module';
import { WorkerModule } from './worker/worker.module';
import { QUEUE_NAMES } from './infrastructure/queue/queue.constants';

/**
 * Worker 根模块
 *
 * - BullMQ 连接由 BullModule.forRoot 管理（专用 Redis 连接）
 * - RedisModule 管理缓存/锁专用 Redis 连接（与 BullMQ 分离）
 * - 通过 createApplicationContext 启动，无 HTTP 服务器
 */
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: resolve(process.cwd(), '../../.env'),
    }),
    BullModule.forRoot({
      connection: {
        host: process.env.REDIS_HOST ?? 'localhost',
        port: parseInt(process.env.REDIS_PORT ?? '6379', 10),
        maxRetriesPerRequest: null, // BullMQ 要求 null
        enableReadyCheck: false,
        lazyConnect: true,
      },
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: 'exponential', delay: 2000 },
        removeOnComplete: 100,
        removeOnFail: 500,
      },
    }),
    BullModule.registerQueue(
      { name: QUEUE_NAMES.INDEX },
      { name: QUEUE_NAMES.EMBEDDING },
      { name: QUEUE_NAMES.REINDEX },
      { name: QUEUE_NAMES.DELETE_CHUNKS },
      { name: QUEUE_NAMES.CLEANUP },
    ),
    PrismaModule,
    MinioModule,
    RedisModule,
    ModelProviderModule,
    EmbeddingModule,
    WorkerModule,
  ],
})
export class AppModule {}
