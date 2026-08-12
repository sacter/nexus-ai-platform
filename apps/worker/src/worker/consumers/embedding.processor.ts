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
  /** 业务幂等键 = versionId，与 index/reindex claim 一致 */
  bizId?: string;
}

/**
 * Embedding 处理器 —— 独立 Queue（IO 密集，5 并发）
 * embed → 持久化向量 → 文档 READY → job DONE → audit_log
 *
 * ★ 幂等设计：
 * - 仅当 claim（index_job）仍为 RUNNING 且 bizId 匹配才执行，DONE/FAILED/无 claim → 跳过
 * - 旧任务残留（chunkIds 非空但 chunks 已被 reindex 重建）→ 不提前置 DONE，直接无操作
 * - 只 embed 尚无向量的 chunk，重试不重复付费调用 embedding API（写入 ON CONFLICT DO NOTHING 兜底）
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
      bizId,
    } = data;

    // ★ 幂等守卫：claim 必须仍为 RUNNING 且 bizId 匹配，才是「当前任务的 embedding」
    const indexJob = await this.prisma.indexJob.findUnique({
      where: { id: indexJobId },
      select: { id: true, status: true, bizId: true },
    });
    if (!indexJob || indexJob.status !== 'RUNNING' || (bizId && indexJob.bizId !== bizId)) {
      this.logger.log(
        `embedding 幂等跳过: doc=${documentId}, reason=${
          indexJob ? `STATUS_${indexJob.status}` : 'CLAIM_NOT_FOUND'
        }`,
      );
      return;
    }

    // 取 chunks → embed
    const chunks = await this.prisma.documentChunk.findMany({
      where: { id: { in: chunkIds }, versionId },
      select: { id: true, content: true },
    });

    // 真实空文档（payload chunkIds 为空）→ 正常完成（0 chunk，文档 READY）
    if (chunkIds.length === 0) {
      this.logger.log(
        `embedding 空文档完成: doc=${documentId}, chunks=0`,
      );
      await this.completeJob(indexJobId, documentId, versionId, kbId, 0, model, dimension);
      return;
    }

    // 旧任务残留：chunkIds 非空但 chunks 已被 reindex 重建替换 → 无操作，
    // 避免把 reindex 复用中的 claim 提前置为 DONE（真正完成由重建后的 embedding 任务负责）
    if (chunks.length === 0) {
      this.logger.log(
        `embedding 跳过(旧任务残留): doc=${documentId}, chunks 已被重建替换`,
      );
      return;
    }

    await this.prisma.indexJob.update({
      where: { id: indexJobId },
      data: { progress: 60, stepDescription: '开始向量化' },
    });

    // ★ 幂等：只 embed 尚无向量的 chunk —— 重试不重复付费调用 embedding API
    const modelName = model ?? 'default';
    const embedded = await this.prisma.chunkEmbedding.findMany({
      where: { chunkId: { in: chunks.map((c) => c.id) }, modelName },
      select: { chunkId: true },
    });
    const embeddedSet = new Set(embedded.map((e) => e.chunkId));
    const pending = chunks.filter((c) => !embeddedSet.has(c.id));

    if (pending.length === 0) {
      this.logger.log(
        `embedding 全部命中已有向量: doc=${documentId}, chunks=${chunks.length}`,
      );
    } else {
      const vectors = await this.embeddingService.embedChunks(
        pending.map((c) => c.content),
        model,
      );

      await this.prisma.indexJob.update({
        where: { id: indexJobId },
        data: { progress: 95, stepDescription: '向量化完成，写入向量库' },
      });

      // 持久化 chunk_embeddings（ON CONFLICT DO NOTHING 兜底幂等）
      await this.persist.saveEmbeddings(
        pending.map((c, i) => ({
          chunkId: c.id,
          kbId,
          modelName,
          vector: vectors[i],
        })),
      );
      this.logger.log(
        `Embedding done: doc=${documentId}, chunks=${pending.length}, model=${modelName}`,
      );
    }

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
