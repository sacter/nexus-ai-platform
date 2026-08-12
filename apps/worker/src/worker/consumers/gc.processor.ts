import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Logger } from '@nestjs/common';
import { QUEUE_NAMES, QUEUE_CONCURRENCY } from '../../infrastructure/queue/queue.constants';
import { PrismaService } from '../../infrastructure/database/prisma/prisma.service';
import { MinioService } from '../../infrastructure/minio/minio.service';
import { PersistService } from '../pipelines/persist/persist.service';

interface GcJob {
  documentId: string;
  kbId: string;
}

/**
 * GC 处理器 —— 软删除后异步清理
 * - delete-chunks：删 document_chunks + 向量（级联）
 * - cleanup：删 MinIO 对象 + audit_log
 */
@Processor(QUEUE_NAMES.DELETE_CHUNKS, { concurrency: QUEUE_CONCURRENCY[QUEUE_NAMES.DELETE_CHUNKS] })
export class DeleteChunksProcessor extends WorkerHost {
  private readonly logger = new Logger(DeleteChunksProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly persist: PersistService,
  ) {
    super();
  }

  async process(job: Job<GcJob>): Promise<void> {
    const p = job.data;
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
  }
}

@Processor(QUEUE_NAMES.CLEANUP, { concurrency: QUEUE_CONCURRENCY[QUEUE_NAMES.CLEANUP] })
export class CleanupProcessor extends WorkerHost {
  private readonly logger = new Logger(CleanupProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly minio: MinioService,
  ) {
    super();
  }

  async process(job: Job<GcJob>): Promise<void> {
    const p = job.data;
    const versions = await this.prisma.documentVersion.findMany({
      where: { documentId: p.documentId },
      select: { id: true, fileUrl: true },
    });
    await this.minio.deleteObjects(versions.map((v) => v.fileUrl));
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
  }
}
