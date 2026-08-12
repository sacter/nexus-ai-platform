import { Inject, Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import type { Queue } from 'bullmq';
import { Prisma } from '@prisma/client';
import { PrismaService } from '@nexus/database';
import { MinioService } from '@nexus/shared';
import { PersistService } from './persist/persist.service';
import type { Loader } from './loaders/loader.interface';
import type { TextSplitterPort } from './splitters/splitter.interface';
import type { DocumentParser } from './parsers/parser.interface';
import { QUEUE_NAMES } from '@nexus/shared';
import { ModelProviderService } from '@nexus/ai-core';

export interface IndexRunResult {
  chunkIds: string[];
  chunkCount: number;
  jobId: string;
  /** 幂等跳过时为 true（重复入队 / 已完成的旧任务） */
  idempotent?: boolean;
}

export interface IndexRunOpts {
  reindex?: boolean;
  /** 业务幂等键（uuid）。INDEX/REINDEX 一律传 versionId —— 死信重试、重新入队后 job.id 会变，唯 bizId 不变 */
  bizId?: string;
}

/** 幂等抢占结果：ok=true 持有 claim；ok=false 为重复执行，按 reason 跳过 */
type ClaimResult =
  | { ok: true; jobId: string }
  | { ok: false; reason: string; jobId: string };

/**
 * Index Pipeline —— Loader → Parser → Splitter → Persist → Enqueue embedding
 * 对应设计文档 2.1 步骤 1-8（index Queue 内执行）
 *
 * ★ 幂等设计（bizId = versionId）：
 * - 入队/重试/死信重建共用同一 bizId，同一版本同时只允许一条 RUNNING 的 index_job
 * - chunk 落库采用「同一事务内先删后插」，重跑只替换、不追加，杜绝重复 chunk
 */
@Injectable()
export class IndexPipeline {
  private readonly logger = new Logger(IndexPipeline.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly minio: MinioService,
    private readonly persist: PersistService,
    @Inject('LOADERS') private readonly loaders: Loader[],
    @Inject('TEXT_SPLITTER') private readonly splitter: TextSplitterPort,
    @Inject('TEXT_PARSER') private readonly parser: DocumentParser,
    @InjectQueue(QUEUE_NAMES.EMBEDDING) private readonly embeddingQueue: Queue,
    private readonly modelProvider: ModelProviderService,
  ) {}

  async run(
    documentId: string,
    versionId: string,
    kbId: string,
    opts?: IndexRunOpts,
  ): Promise<IndexRunResult> {
    const reindex = opts?.reindex ?? false;
    const bizId = opts?.bizId ?? versionId;

    // ★ 0. 幂等抢占：同一 bizId 只允许一条 RUNNING；重复/已完成 → 直接跳过
    const claim = await this.claimJob(bizId, { documentId, versionId, reindex });
    if (!claim.ok) {
      this.logger.log(
        `index 幂等跳过: doc=${documentId}, version=${versionId}, reason=${claim.reason}`,
      );
      return {
        chunkIds: [],
        chunkCount: 0,
        jobId: claim.jobId,
        idempotent: true,
      };
    }
    const jobId = claim.jobId;

    // 1. 文档 → PROCESSING
    await this.prisma.document.update({
      where: { id: documentId },
      data: { status: 'PROCESSING', errorMessage: null, updatedAt: new Date() },
    });

    const updateJob = (
      step: number,
      progress: number,
      desc: string,
      client: PrismaService | Prisma.TransactionClient = this.prisma,
    ) =>
      client.indexJob.update({
        where: { id: jobId },
        data: { currentStep: step, progress, stepDescription: desc },
      });

    try {
      // 2. MinIO 下载
      const version = await this.prisma.documentVersion.findUnique({
        where: { id: versionId },
      });
      if (!version) throw new Error(`version ${versionId} not found`);
      const buffer = await this.minio.downloadObject(version.fileUrl);
      await updateJob(2, 10, `下载文件完成`);

      // 3. Loader 策略选择 —— mimeType 取自 Document（DocumentVersion 无 mimeType 字段）
      const doc = await this.prisma.document.findUnique({
        where: { id: documentId },
      });
      const mimeType = doc?.mimeType ?? '';
      const loader = this.loaders.find((l) =>
        l.supports(mimeType, version.fileUrl),
      );
      if (!loader) throw new Error(`no loader for mimeType=${mimeType}`);
      const rawPages = await loader.load(buffer, mimeType, version.fileUrl);
      await updateJob(3, 20, `Loader: ${loader.constructor.name}`);

      // 4. Parser (提取纯文本 + 元数据)
      const parsed = await this.parser.parse(rawPages);
      await updateJob(4, 30, '解析完成');

      // 5. Splitter (分 chunk)
      const chunks = this.splitter.split(parsed.pages);
      await updateJob(5, 50, `分割为 ${chunks.length} 个 chunk`);

      // 6. Persist chunks (落库) —— ★ 事务：先删同版本旧 chunks（级联向量）+ 插入新 chunks + 统计同生共死
      const { count, ids } = await this.prisma.$transaction(async (tx) => {
        // ★ 幂等：重试/重复执行先清该版本已有 chunks 再插入，永不产生重复数据
        await tx.documentChunk.deleteMany({ where: { versionId } });
        const saved = await this.persist.saveChunks(versionId, chunks, tx);
        await tx.documentVersion.update({
          where: { id: versionId },
          data: {
            chunkCount: saved.count,
            status: 'PROCESSING',
            // 真实页数：前端上传时 pageCount=0，解析完成后此处回写
            pageCount: parsed.totalPages,
          },
        });
        await tx.document.update({
          where: { id: documentId },
          data: { pageCount: parsed.totalPages },
        });
        await updateJob(6, 60, `已落库 ${saved.count} 个 chunk`, tx);
        return saved;
      });

      // 7. Enqueue → embedding Queue（★ 独立 Queue）
      const kb = await this.prisma.knowledgeBase.findUnique({
        where: { id: kbId },
      });
      const modelName = kb?.embeddingModel || undefined;
      const { dimension } =
        this.modelProvider.resolveEmbeddingConfig(modelName);

      await this.embeddingQueue.add('embed-chunks', {
        documentId,
        versionId,
        kbId,
        chunkIds: ids,
        model: modelName,
        dimension,
        indexJobId: jobId,
        bizId,
      });
      this.logger.log(
        `IndexPipeline done: doc=${documentId}, chunks=${count}, enqueued embedding`,
      );
      return { chunkIds: ids, chunkCount: count, jobId };
    } catch (error) {
      await this.prisma.indexJob.update({
        where: { id: jobId },
        data: { status: 'FAILED', errorMessage: (error as Error).message },
      });
      await this.prisma.document.update({
        where: { id: documentId },
        data: {
          status: 'FAILED',
          errorMessage: (error as Error).message,
          updatedAt: new Date(),
        },
      });
      throw error;
    }
  }

  /**
   * 幂等抢占 —— 同一 bizId（versionId）同时只允许一条 RUNNING 的 index_job
   * - create 成功 → 抢占成功
   * - P2002 冲突 → 已有记录，按状态决策：
   *   - RUNNING            → 同一业务正在执行，跳过（防重复/并发）
   *   - DONE 且非 reindex  → 已完成，跳过（防重复初始索引）
   *   - DONE 且 reindex / FAILED → 原子接管（updateMany 状态校验，防止并发双接管）
   */
  private async claimJob(
    bizId: string,
    input: { documentId: string; versionId: string; reindex: boolean },
  ): Promise<ClaimResult> {
    const jobType = input.reindex ? 'REINDEX' : 'INDEX';
    try {
      const created = await this.prisma.indexJob.create({
        data: {
          bizId,
          documentId: input.documentId,
          versionId: input.versionId,
          jobType,
          status: 'RUNNING',
          progress: 0,
          totalSteps: 8,
          currentStep: 1,
          stepDescription: '开始索引',
          startedAt: new Date(),
        },
      });
      return { ok: true, jobId: created.id };
    } catch (error) {
      // 唯一键冲突 → 已有同 bizId 记录
      if (
        !(error instanceof Prisma.PrismaClientKnownRequestError) ||
        error.code !== 'P2002'
      ) {
        throw error;
      }
      const existing = await this.prisma.indexJob.findFirst({
        where: { bizId },
        select: { id: true, status: true },
      });
      if (!existing) throw error; // 理论不可达（P2002 必有记录），兜底

      if (existing.status === 'RUNNING') {
        return { ok: false, reason: 'RUNNING', jobId: existing.id };
      }
      if (existing.status === 'DONE' && !input.reindex) {
        return { ok: false, reason: 'ALREADY_DONE', jobId: existing.id };
      }
      // 接管旧 claim（reindex 的 DONE / 任何 FAILED 重试）
      const reclaimed = await this.prisma.indexJob.updateMany({
        where: { id: existing.id, status: { in: ['DONE', 'FAILED'] } },
        data: {
          status: 'RUNNING',
          progress: 0,
          currentStep: 1,
          stepDescription: '开始索引',
          errorMessage: null,
          startedAt: new Date(),
          updatedAt: new Date(),
        },
      });
      if (reclaimed.count === 0) {
        return { ok: false, reason: 'CONCURRENT_RECLAIM', jobId: existing.id };
      }
      return { ok: true, jobId: existing.id };
    }
  }
}
