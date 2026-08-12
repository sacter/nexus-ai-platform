import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

/**
 * Worker 独立进程 —— 仅启动 BullMQ Workers，不监听 HTTP
 *
 * 启动方式：cd apps/worker && pnpm start:dev
 * 进程通过 BullMQ Worker 的 Redis 连接保持存活
 */
async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['log', 'error', 'warn', 'debug'],
  });

  // 优雅关闭：SIGTERM/SIGINT → 关闭 NestJS 上下文（触发 Worker.close()）
  const shutdown = async (signal: string) => {
    console.log(`Worker received ${signal}, shutting down...`);
    await app.close();
    process.exit(0);
  };
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  const port = process.env.REDIS_PORT || 6379;
  console.log(`🚀 Worker running at http://localhost:${port}, (BullMQ consumers ready)`);
}

void bootstrap();
