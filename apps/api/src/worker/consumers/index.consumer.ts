import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { Worker } from 'bullmq';
import Redis from 'ioredis';
import { QueueService } from '../../infrastructure/queue/queue.service';
import {
  QUEUE_NAMES,
  QUEUE_CONCURRENCY,
} from '../../infrastructure/queue/queue.constants';
import { DOCUMENT_UPLOADED } from '../../infrastructure/event-bus/events/document-uploaded.event';
import type { DocumentUploadedEvent } from '../../infrastructure/event-bus/events/document-uploaded.event';
import { IndexPipeline } from '../pipelines/index-pipeline';

/**
 * Index 消费者
 * - @OnEvent('document.uploaded') → index Queue 入队
 * - BullMQ Worker 消费 index Queue（3 并发）→ IndexPipeline
 */
@Injectable()
export class IndexConsumer implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(IndexConsumer.name);
  private worker!: Worker;

  constructor(
    private readonly queueService: QueueService,
    private readonly pipeline: IndexPipeline,
  ) {}

  @OnEvent(DOCUMENT_UPLOADED)
  async handleUploaded(payload: DocumentUploadedEvent) {
    await this.queueService.add(QUEUE_NAMES.INDEX, 'index-document', payload);
    this.logger.log(`enqueued index job: doc=${payload.documentId}`);
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  async onModuleInit() {
    const connection = new Redis({
      host: process.env.REDIS_HOST ?? 'localhost',
      port: parseInt(process.env.REDIS_PORT ?? '6379', 10),
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
    });
    this.worker = new Worker(
      QUEUE_NAMES.INDEX,
      async (job) => {
        const payload = job.data as DocumentUploadedEvent;
        await this.pipeline.run(
          payload.documentId,
          payload.versionId,
          payload.kbId,
        );
        return { documentId: payload.documentId };
      },
      { connection, concurrency: QUEUE_CONCURRENCY[QUEUE_NAMES.INDEX] },
    );
    this.worker.on('failed', (job, err) => {
      this.logger.error(`index job failed: ${job?.id}`, err);
    });
    this.logger.log(
      `IndexConsumer started (concurrency=${QUEUE_CONCURRENCY[QUEUE_NAMES.INDEX]})`,
    );
  }

  async onModuleDestroy() {
    await this.worker?.close();
  }
}
