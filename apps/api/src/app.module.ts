import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { resolve } from 'path';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './infrastructure/database/prisma/prisma.module';
import { UserModule } from './modules/user/user.module';
import { AuthModule } from './modules/auth/auth.module';
import { WorkerModule } from './worker/worker.module';
import { KnowledgeBaseModule } from './modules/knowledge/knowledge-base/knowledge-base.module';
import { PermissionModule } from './modules/knowledge/permission/permission.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      // .env 位于 monorepo 根目录，在 apps/api/ 启动时需向上两级
      envFilePath: resolve(process.cwd(), '../../.env'),
    }),
    PrismaModule,
    UserModule,
    AuthModule,
    WorkerModule,
    KnowledgeBaseModule,
    PermissionModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
