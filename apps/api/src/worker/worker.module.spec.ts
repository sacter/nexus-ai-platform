import { Test } from '@nestjs/testing';
import { WorkerModule } from './worker.module';
import { IndexPipeline } from './pipelines/index-pipeline';
import { PrismaModule } from '../infrastructure/database/prisma/prisma.module';
import { MinioModule } from '../infrastructure/minio/minio.module';
import { RedisModule } from '../infrastructure/redis/redis.module';
import { QueueModule } from '../infrastructure/queue/queue.module';
import { EventBusModule } from '../infrastructure/event-bus/event-bus.module';
import { ModelProviderModule } from '../modules/model-provider/model-provider.module';
import { EmbeddingModule } from '../modules/embedding/embedding.module';

describe('WorkerModule DI', () => {
  it('resolves IndexPipeline with loaders/splitter/parser tokens', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [
        WorkerModule,
        PrismaModule,
        MinioModule,
        RedisModule,
        QueueModule,
        EventBusModule,
        ModelProviderModule,
        EmbeddingModule,
      ],
    }).compile();
    const pipeline = moduleRef.get(IndexPipeline);
    expect(pipeline).toBeDefined();
  });
});
