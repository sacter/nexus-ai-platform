import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { BullModule } from '@nestjs/bullmq';
import { resolve } from 'path';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from '@nexus/database';
import { MinioModule } from '@nexus/shared';
import { EventBusModule } from './infrastructure/event-bus/event-bus.module';
import { RedisModule } from '@nexus/shared';
import { EmbeddingModule } from '@nexus/ai-core';
import { UserModule } from './modules/user/user.module';
import { AuthModule } from './modules/auth/auth.module';
import { KnowledgeBaseModule } from './modules/knowledge/knowledge-base/knowledge-base.module';
import { PermissionModule } from './modules/knowledge/permission/permission.module';
import { DocumentModule } from './modules/knowledge/document/document.module';
import { VersionModule } from './modules/knowledge/version/version.module';
import { ChunkModule } from './modules/knowledge/chunk/chunk.module';
import { UploadModule } from './modules/upload/upload.module';
import { RetrievalModule } from './modules/retrieval/retrieval.module';
import { ApiKeyModule } from './modules/api-key/api-key.module';
import { ModelModule } from './modules/model/model.module';
import { ChatModule } from './modules/chat/chat.module';
import { AiApplicationModule } from './modules/ai-application/ai-application.module';
import { WorkflowModule } from './modules/workflow/workflow.module';
import { PromptTemplateModule } from './modules/prompt_template/prompt_template.module';
import { ToolModule } from './modules/tool/tool.module';

import { QUEUE_NAMES } from '@nexus/shared';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      // .env 位于 monorepo 根目录，在 apps/api/ 启动时需向上两级
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
    EventBusModule,
    RedisModule,
    EmbeddingModule,
    UserModule,
    AuthModule,
    KnowledgeBaseModule,
    PermissionModule,
    DocumentModule,
    VersionModule,
    ChunkModule,
    UploadModule,
    RetrievalModule,
    ApiKeyModule,
    ModelModule,
    ChatModule,
    AiApplicationModule,
    WorkflowModule,
    PromptTemplateModule,
    ToolModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
