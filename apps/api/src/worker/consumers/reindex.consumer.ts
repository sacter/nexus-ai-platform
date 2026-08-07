import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { Worker } from 'bullmq';
import Redis from 'ioredis';
import { QueueService } from '../../infrastructure/queue/queue.service';
import { QUEUE_NAMES, QUEUE_CONCURRENCY } from '../../infrastructure/queue/queue.constants';
import { INDEX_REQUESTED } from '../../infrastructure/event-bus/events/index-requested.event';
import type { IndexRequestedEvent } from '../../infrastructure/event-bus/events/index-requested.event';
import { ReindexPipeline } from '../pipelines/reindex-pipeline';

@Injectable()
export class ReindexConsumer implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ReindexConsumer.name);
  private worker!: Worker;

  constructor(
    private readonly queueService: QueueService,
    private readonly reindexPipeline: ReindexPipeline,
  ) {}

  @OnEvent(INDEX_REQUESTED)
  async handleIndexRequested(payload: IndexRequestedEvent) {
    await this.queueService.add(QUEUE_NAMES.REINDEX, 'reindex-document', payload);
  }

  async onModuleInit() {
    const connection = new Redis({
      host: process.env.REDIS_HOST ?? 'localhost',
      port: parseInt(process.env.REDIS_PORT ?? '6379', 10),
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
    });
    this.worker = new Worker(
      QUEUE_NAMES.REINDEX,
      async (job) => {
        const p = job.data as IndexRequestedEvent;
        await this.reindexPipeline.run(p.documentId, p.versionId, p.kbId);
      },
      { connection, concurrency: QUEUE_CONCURRENCY[QUEUE_NAMES.REINDEX] },
    );
    this.worker.on('failed', (job, err) => this.logger.error(`reindex job failed: ${job?.id}`, err));
  }

  async onModuleDestroy() {
    await this.worker?.close();
  }
}
