import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { Worker } from 'bullmq';
import Redis from 'ioredis';
import { QueueService } from '../../infrastructure/queue/queue.service';
import { QUEUE_NAMES, QUEUE_CONCURRENCY } from '../../infrastructure/queue/queue.constants';
import { DOCUMENT_DELETED } from '../../infrastructure/event-bus/events/document-deleted.event';
import type { DocumentDeletedEvent } from '../../infrastructure/event-bus/events/document-deleted.event';
import { PrismaService } from '../../infrastructure/database/prisma/prisma.service';
import { MinioService } from '../../infrastructure/minio/minio.service';
import { PersistService } from '../pipelines/persist/persist.service';

/**
 * GC 消费者 —— 软删除后异步清理（delete-chunks + cleanup 两个独立 Queue，功能4）
 *
 * delete-chunks：删 document_chunks + 向量（级联）
 * cleanup：删 MinIO 对象 + audit_log
 */
@Injectable()
export class GcConsumer implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(GcConsumer.name);
  private deleteChunksWorker!: Worker;
  private cleanupWorker!: Worker;

  constructor(
    private readonly queueService: QueueService,
    private readonly prisma: PrismaService,
    private readonly minio: MinioService,
    private readonly persist: PersistService,
  ) {}

  @OnEvent(DOCUMENT_DELETED)
  async handleDeleted(payload: DocumentDeletedEvent) {
    await this.queueService.add(QUEUE_NAMES.DELETE_CHUNKS, 'delete-chunks', payload);
    await this.queueService.add(QUEUE_NAMES.CLEANUP, 'cleanup-document', payload);
    this.logger.log(`enqueued GC jobs: doc=${payload.documentId}`);
  }

  async onModuleInit() {
    const mkConnection = () =>
      new Redis({
        host: process.env.REDIS_HOST ?? 'localhost',
        port: parseInt(process.env.REDIS_PORT ?? '6379', 10),
        maxRetriesPerRequest: null,
        enableReadyCheck: false,
      });

    this.deleteChunksWorker = new Worker(
      QUEUE_NAMES.DELETE_CHUNKS,
      async (job) => {
        const p = job.data as DocumentDeletedEvent;
        const count = await this.persist.deleteChunksByDocument(p.documentId);
        await this.prisma.indexJob.create({
          data: {
            documentId: p.documentId,
            jobType: 'DELETE_CHUNKS',
            status: 'DONE',
            progress: 100,
            stepDescription: `清理 ${count.count} 个 chunk`,
          },
        });
        this.logger.log(`delete-chunks done: doc=${p.documentId}, count=${count.count}`);
      },
      { connection: mkConnection(), concurrency: QUEUE_CONCURRENCY[QUEUE_NAMES.DELETE_CHUNKS] },
    );

    this.cleanupWorker = new Worker(
      QUEUE_NAMES.CLEANUP,
      async (job) => {
        const p = job.data as DocumentDeletedEvent;
        const versions = await this.prisma.documentVersion.findMany({
          where: { documentId: p.documentId },
          select: { id: true, fileUrl: true },
        });
        // MinIO 清理所有版本文件
        await this.minio.deleteObjects(versions.map((v) => v.fileUrl));
        // audit_log
        await this.prisma.auditLog.create({
          data: {
            action: 'DOCUMENT_DELETE',
            entityType: 'document',
            entityId: p.documentId,
            kbId: p.kbId,
            details: { cleanedVersions: versions.length },
          },
        });
        this.logger.log(`cleanup done: doc=${p.documentId}, versions=${versions.length}`);
      },
      { connection: mkConnection(), concurrency: QUEUE_CONCURRENCY[QUEUE_NAMES.CLEANUP] },
    );

    this.deleteChunksWorker.on('failed', (job, err) => this.logger.error(`delete-chunks failed: ${job?.id}`, err));
    this.cleanupWorker.on('failed', (job, err) => this.logger.error(`cleanup failed: ${job?.id}`, err));
    this.logger.log('GcConsumer started (delete-chunks + cleanup)');
  }

  async onModuleDestroy() {
    await this.deleteChunksWorker?.close();
    await this.cleanupWorker?.close();
  }
}
