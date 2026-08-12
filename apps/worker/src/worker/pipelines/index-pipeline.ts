import { Inject, Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import type { Queue } from 'bullmq';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../../infrastructure/database/prisma/prisma.service';
import { MinioService } from '../../infrastructure/minio/minio.service';
import { PersistService } from './persist/persist.service';
import type { Loader } from './loaders/loader.interface';
import type { TextSplitterPort } from './splitters/splitter.interface';
import type { DocumentParser } from './parsers/parser.interface';
import { QUEUE_NAMES } from '../../infrastructure/queue/queue.constants';
import { ModelProviderService } from '../../modules/model-provider/model-provider.service';

export interface IndexRunResult {
  chunkIds: string[];
  chunkCount: number;
  jobId: string;
}

/**
 * Index Pipeline —— Loader → Parser → Splitter → Persist → Enqueue embedding
 * 对应设计文档 2.1 步骤 1-8（index Queue 内执行）
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
    opts?: { reindex?: boolean },
  ): Promise<IndexRunResult> {
    // 1. 文档 → PROCESSING
    await this.prisma.document.update({
      where: { id: documentId },
      data: { status: 'PROCESSING', errorMessage: null, updatedAt: new Date() },
    });

    // 2. 创建 index_job
    const job = await this.prisma.indexJob.create({
      data: {
        documentId,
        versionId,
        jobType: opts?.reindex ? 'REINDEX' : 'INDEX',
        status: 'RUNNING',
        progress: 0,
        totalSteps: 8,
        currentStep: 1,
        stepDescription: '开始索引',
        startedAt: new Date(),
      },
    });
    const updateJob = (
      step: number,
      progress: number,
      desc: string,
      client: PrismaService | Prisma.TransactionClient = this.prisma,
    ) =>
      client.indexJob.update({
        where: { id: job.id },
        data: { currentStep: step, progress, stepDescription: desc },
      });

    try {
      // 3. MinIO 下载
      const version = await this.prisma.documentVersion.findUnique({
        where: { id: versionId },
      });
      if (!version) throw new Error(`version ${versionId} not found`);
      const buffer = await this.minio.downloadObject(version.fileUrl);
      await updateJob(2, 10, `下载文件完成`);

      // 4. Loader 策略选择 —— mimeType 取自 Document（DocumentVersion 无 mimeType 字段）
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

      // 5. Parser (提取纯文本 + 元数据)
      const parsed = await this.parser.parse(rawPages);
      await updateJob(4, 30, '解析完成');

      // 6. Splitter (分 chunk)
      const chunks = this.splitter.split(parsed.pages);
      await updateJob(5, 50, `分割为 ${chunks.length} 个 chunk`);

      // 7. Persist chunks (落库) —— ★ 事务：chunks + chunkCount + pageCount + progress 同生共死
      const { count, ids } = await this.prisma.$transaction(async (tx) => {
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

      // 8. Enqueue → embedding Queue（★ 独立 Queue）
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
        indexJobId: job.id,
      });
      this.logger.log(
        `IndexPipeline done: doc=${documentId}, chunks=${count}, enqueued embedding`,
      );
      return { chunkIds: ids, chunkCount: count, jobId: job.id };
    } catch (error) {
      await this.prisma.indexJob.update({
        where: { id: job.id },
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
}
