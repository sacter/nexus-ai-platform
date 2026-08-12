import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { WorkerService } from './worker.service';
import { IndexPipeline } from './pipelines/index-pipeline';
import { ReindexPipeline } from './pipelines/reindex-pipeline';
import { TextSplitter } from './pipelines/splitters/text-splitter';
import { TextParser } from './pipelines/parsers/text-parser';
import { PdfLoader } from './pipelines/loaders/pdf-loader';
import { MarkdownLoader } from './pipelines/loaders/markdown-loader';
import { TextLoader } from './pipelines/loaders/text-loader';
import { PersistService } from './pipelines/persist/persist.service';
import { IndexProcessor } from './consumers/index.processor';
import { EmbeddingProcessor } from './consumers/embedding.processor';
import { DeleteChunksProcessor, CleanupProcessor } from './consumers/gc.processor';
import { ReindexProcessor } from './consumers/reindex.processor';
import { QUEUE_NAMES } from '@nexus/shared';

@Module({
  imports: [
    BullModule.registerQueue({ name: QUEUE_NAMES.EMBEDDING }),
  ],
  providers: [
    WorkerService,
    IndexPipeline,
    ReindexPipeline,
    PersistService,
    {
      provide: 'LOADERS',
      useFactory: () => [
        new PdfLoader(),
        new MarkdownLoader(),
        new TextLoader(),
      ],
    },
    { provide: 'TEXT_SPLITTER', useClass: TextSplitter },
    { provide: 'TEXT_PARSER', useClass: TextParser },
    IndexProcessor,
    EmbeddingProcessor,
    DeleteChunksProcessor,
    CleanupProcessor,
    ReindexProcessor,
  ],
  exports: [WorkerService],
})
export class WorkerModule {}
