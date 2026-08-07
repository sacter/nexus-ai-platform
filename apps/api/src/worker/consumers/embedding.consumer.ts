import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { Worker } from 'bullmq';
import Redis from 'ioredis';
import { QueueService } from '../../infrastructure/queue/queue.service';
import {
  QUEUE_NAMES,
  QUEUE_CONCURRENCY,
} from '../../infrastructure/queue/queue.constants';
import { EmbeddingService } from '../../modules/embedding/embedding.service';
import { PrismaService } from '../../infrastructure/database/prisma/prisma.service';
import { PersistService } from '../pipelines/persist/persist.service';

interface EmbedChunksJob {
  documentId: string;
  versionId: string;
  kbId: string;
  chunkIds: string[];
  model?: string;
  dimension: number;
  indexJobId: string;
}

/**
 * Embedding 消费者 —— ★ 独立 Queue（IO 密集，5 并发）
 * 步骤 9-13：embed → 持久化向量 → 文档 READY → job DONE → audit_log
 */
@Injectable()
export class EmbeddingConsumer implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(EmbeddingConsumer.name);
  private worker!: Worker;

  constructor(
    private readonly queueService: QueueService,
    private readonly embeddingService: EmbeddingService,
    private readonly prisma: PrismaService,
    private readonly persist: PersistService,
  ) {}

  // eslint-disable-next-line @typescript-eslint/require-await
  async onModuleInit() {
    const connection = new Redis({
      host: process.env.REDIS_HOST ?? 'localhost',
      port: parseInt(process.env.REDIS_PORT ?? '6379', 10),
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
    });
    this.worker = new Worker(
      QUEUE_NAMES.EMBEDDING,
      async (job) => {
        const data = job.data as EmbedChunksJob;
        await this.handle(data);
        return { documentId: data.documentId };
      },
      { connection, concurrency: QUEUE_CONCURRENCY[QUEUE_NAMES.EMBEDDING] },
    );
    this.worker.on('failed', (job, err) => {
      this.logger.error(`embedding job failed: ${job?.id}`, err);
    });
    this.logger.log(
      `EmbeddingConsumer started (concurrency=${QUEUE_CONCURRENCY[QUEUE_NAMES.EMBEDDING]})`,
    );
  }

  async onModuleDestroy() {
    await this.worker?.close();
  }

  private async handle(data: EmbedChunksJob) {
    const {
      documentId,
      versionId,
      kbId,
      chunkIds,
      model,
      dimension,
      indexJobId,
    } = data;

    // 9. 取 chunks → embed（60→95）
    const chunks = await this.prisma.documentChunk.findMany({
      where: { id: { in: chunkIds }, versionId },
      select: { id: true, content: true },
    });
    if (chunks.length === 0) {
      await this.completeJob(
        indexJobId,
        documentId,
        versionId,
        kbId,
        0,
        model,
        dimension,
      );
      return;
    }

    await this.prisma.indexJob.update({
      where: { id: indexJobId },
      data: { progress: 60, stepDescription: '开始向量化' },
    });

    const vectors = await this.embeddingService.embedChunks(
      chunks.map((c) => c.content),
      model,
    );

    await this.prisma.indexJob.update({
      where: { id: indexJobId },
      data: { progress: 95, stepDescription: '向量化完成，写入向量库' },
    });

    // 10. 持久化 chunk_embeddings
    await this.persist.saveEmbeddings(
      chunks.map((c, i) => ({
        chunkId: c.id,
        kbId,
        modelName: model ?? 'default',
        vector: vectors[i],
      })),
    );

    await this.completeJob(
      indexJobId,
      documentId,
      versionId,
      kbId,
      chunks.length,
      model,
      dimension,
    );
  }

  private async completeJob(
    indexJobId: string,
    documentId: string,
    versionId: string,
    kbId: string,
    chunkCount: number,
    model?: string,
    dimension?: number,
  ) {
    const resolved = await this.prisma.document.findUnique({
      where: { id: documentId },
      include: { kb: { select: { embeddingModel: true } } },
    });
    const modelName = model ?? resolved?.kb.embeddingModel ?? undefined;
    const dim = dimension ?? resolved?.embeddingDim ?? undefined;

    // 11. 文档 → READY
    await this.prisma.document.update({
      where: { id: documentId },
      data: {
        status: 'READY',
        chunkCount,
        embeddingModel: modelName ?? null,
        embeddingDim: dim ?? null,
        updatedAt: new Date(),
      },
    });
    // 版本 → READY
    await this.prisma.documentVersion.update({
      where: { id: versionId },
      data: { status: 'READY', chunkCount },
    });
    // 12. job → DONE
    await this.prisma.indexJob.update({
      where: { id: indexJobId },
      data: {
        status: 'DONE',
        progress: 100,
        completedAt: new Date(),
        stepDescription: '索引完成',
      },
    });
    // 13. audit_log
    await this.prisma.auditLog.create({
      data: {
        userId: resolved?.userId ?? null,
        action: 'DOCUMENT_UPLOAD',
        entityType: 'document',
        entityId: documentId,
        kbId,
        details: { chunkCount, embeddingModel: modelName, embeddingDim: dim },
      },
    });
  }
}
