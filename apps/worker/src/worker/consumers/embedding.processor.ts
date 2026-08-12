import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Logger } from '@nestjs/common';
import { QUEUE_NAMES, QUEUE_CONCURRENCY } from '@nexus/shared';
import { EmbeddingService } from '@nexus/ai-core';
import { PrismaService } from '@nexus/database';
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
 * Embedding 处理器 —— 独立 Queue（IO 密集，5 并发）
 * embed → 持久化向量 → 文档 READY → job DONE → audit_log
 */
@Processor(QUEUE_NAMES.EMBEDDING, { concurrency: QUEUE_CONCURRENCY[QUEUE_NAMES.EMBEDDING] })
export class EmbeddingProcessor extends WorkerHost {
  private readonly logger = new Logger(EmbeddingProcessor.name);

  constructor(
    private readonly embeddingService: EmbeddingService,
    private readonly prisma: PrismaService,
    private readonly persist: PersistService,
  ) {
    super();
  }

  async process(job: Job<EmbedChunksJob>): Promise<void> {
    const data = job.data;
    const {
      documentId,
      versionId,
      kbId,
      chunkIds,
      model,
      dimension,
      indexJobId,
    } = data;

    // 取 chunks → embed
    const chunks = await this.prisma.documentChunk.findMany({
      where: { id: { in: chunkIds }, versionId },
      select: { id: true, content: true },
    });
    if (chunks.length === 0) {
      this.logger.warn(
        `embedding job skipped: no chunks found for doc=${documentId}`,
      );
      await this.completeJob(indexJobId, documentId, versionId, kbId, 0, model, dimension);
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

    // 持久化 chunk_embeddings
    await this.persist.saveEmbeddings(
      chunks.map((c, i) => ({
        chunkId: c.id,
        kbId,
        modelName: model ?? 'default',
        vector: vectors[i],
      })),
    );
    this.logger.log(
      `Embedding done: doc=${documentId}, chunks=${chunks.length}, model=${model ?? 'default'}`,
    );

    await this.completeJob(indexJobId, documentId, versionId, kbId, chunks.length, model, dimension);
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
    await this.prisma.documentVersion.update({
      where: { id: versionId },
      data: { status: 'READY', chunkCount },
    });
    await this.prisma.indexJob.update({
      where: { id: indexJobId },
      data: {
        status: 'DONE',
        progress: 100,
        completedAt: new Date(),
        stepDescription: '索引完成',
      },
    });
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
