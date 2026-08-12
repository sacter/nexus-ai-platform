import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Logger } from '@nestjs/common';
import { QUEUE_NAMES, QUEUE_CONCURRENCY } from '@nexus/shared';
import { ReindexPipeline } from '../pipelines/reindex-pipeline';

interface ReindexJob {
  documentId: string;
  versionId: string;
  kbId: string;
}

/**
 * Reindex 处理器 —— 消费 reindex Queue（2 并发）
 * 清空旧 chunks + 复用 IndexPipeline 重建
 */
@Processor(QUEUE_NAMES.REINDEX, { concurrency: QUEUE_CONCURRENCY[QUEUE_NAMES.REINDEX] })
export class ReindexProcessor extends WorkerHost {
  private readonly logger = new Logger(ReindexProcessor.name);

  constructor(private readonly reindexPipeline: ReindexPipeline) {
    super();
  }

  async process(job: Job<ReindexJob>): Promise<void> {
    const p = job.data;
    await this.reindexPipeline.run(p.documentId, p.versionId, p.kbId);
  }
}
