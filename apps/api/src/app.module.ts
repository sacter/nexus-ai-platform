import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { resolve } from 'path';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './infrastructure/database/prisma/prisma.module';
import { MinioModule } from './infrastructure/minio/minio.module';
import { EventBusModule } from './infrastructure/event-bus/event-bus.module';
import { RedisModule } from './infrastructure/redis/redis.module';
import { QueueModule } from './infrastructure/queue/queue.module';
import { ModelProviderModule } from './modules/model-provider/model-provider.module';
import { EmbeddingModule } from './modules/embedding/embedding.module';
import { UserModule } from './modules/user/user.module';
import { AuthModule } from './modules/auth/auth.module';
import { WorkerModule } from './worker/worker.module';
import { KnowledgeBaseModule } from './modules/knowledge/knowledge-base/knowledge-base.module';
import { PermissionModule } from './modules/knowledge/permission/permission.module';
import { DocumentModule } from './modules/knowledge/document/document.module';
import { VersionModule } from './modules/knowledge/version/version.module';
import { UploadModule } from './modules/upload/upload.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      // .env 位于 monorepo 根目录，在 apps/api/ 启动时需向上两级
      envFilePath: resolve(process.cwd(), '../../.env'),
    }),
    PrismaModule,
    MinioModule,
    EventBusModule,
    RedisModule,
    QueueModule,
    ModelProviderModule,
    EmbeddingModule,
    UserModule,
    AuthModule,
    WorkerModule,
    KnowledgeBaseModule,
    PermissionModule,
    DocumentModule,
    VersionModule,
    UploadModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
