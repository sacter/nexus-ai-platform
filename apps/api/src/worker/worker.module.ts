import { Module } from '@nestjs/common';
import { WorkerService } from './worker.service';
import { SessionLockService } from './session-lock.service';
import { IndexPipeline } from './pipelines/index-pipeline';
import { ReindexPipeline } from './pipelines/reindex-pipeline';
import { TextSplitter } from './pipelines/splitters/text-splitter';
import { TextParser } from './pipelines/parsers/text-parser';
import { PdfLoader } from './pipelines/loaders/pdf-loader';
import { MarkdownLoader } from './pipelines/loaders/markdown-loader';
import { TextLoader } from './pipelines/loaders/text-loader';
import { PersistService } from './pipelines/persist/persist.service';
import { IndexConsumer } from './consumers/index.consumer';
import { EmbeddingConsumer } from './consumers/embedding.consumer';
import { GcConsumer } from './consumers/gc.consumer';
import { ReindexConsumer } from './consumers/reindex.consumer';

@Module({
  providers: [
    WorkerService,
    SessionLockService,
    // Pipelines
    IndexPipeline,
    ReindexPipeline,
    PersistService,
    { provide: 'LOADERS', useFactory: () => [new PdfLoader(), new MarkdownLoader(), new TextLoader()] },
    { provide: 'TEXT_SPLITTER', useClass: TextSplitter },
    { provide: 'TEXT_PARSER', useClass: TextParser },
    // Consumers
    IndexConsumer,
    EmbeddingConsumer,
    GcConsumer,
    ReindexConsumer,
  ],
  exports: [SessionLockService, WorkerService],
})
export class WorkerModule {}
