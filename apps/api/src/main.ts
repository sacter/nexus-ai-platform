import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import { ResponseInterceptor } from './common/interceptors/response.interceptor';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';

async function bootstrap() {
  // ── BigInt 序列化：JSON 不支持 BigInt，转为字符串避免精度丢失 ──
  // Prisma 的 BigInt 字段（如 Document.fileSize）序列化时需要此补丁
  (BigInt.prototype as unknown as { toJSON: () => string }).toJSON = function (
    this: bigint,
  ) {
    return this.toString();
  };

  const app = await NestFactory.create(AppModule, {
    logger: ['error', 'warn'],
  });

  // ── CORS ──
  app.enableCors({
    origin: process.env.CORS_ORIGIN ?? '*',
    credentials: true,
  });

  // ── 全局路径前缀 ──
  app.setGlobalPrefix('api/v1');

  // ── 全局管道：自动校验 DTO ──
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // 自动剥离 DTO 未声明的字段
      transform: true, // 自动转换类型（如 string → number）
      forbidNonWhitelisted: false, // 放行未声明字段（不报 400）
    }),
  );

  // ── 全局拦截器：统一成功响应格式 ──
  app.useGlobalInterceptors(new ResponseInterceptor());

  // ── 全局过滤器：统一异常响应格式 ──
  app.useGlobalFilters(new HttpExceptionFilter());

  // 监听 SIGTERM / SIGINT 信号，用优雅关闭
  app.enableShutdownHooks();

  const port = process.env.PORT ?? 3000;
  await app.listen(port);
  console.log(`🚀 API running at http://localhost:${port}`);
}

void bootstrap();
