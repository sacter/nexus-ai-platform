import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Logger } from '@nestjs/common';
import { QUEUE_NAMES, QUEUE_CONCURRENCY } from '@nexus/shared';
import { IndexPipeline } from '../pipelines/index-pipeline';

interface IndexJob {
  documentId: string;
  versionId: string;
  kbId: string;
  /** 业务幂等键 = versionId（死信重试、重新入队后仍不变） */
  bizId?: string;
}

/**
 * Index 处理器 —— 消费 index Queue（3 并发）
 * Loader → Parser → Splitter → Persist → Enqueue embedding
 */
@Processor(QUEUE_NAMES.INDEX, { concurrency: QUEUE_CONCURRENCY[QUEUE_NAMES.INDEX] })
export class IndexProcessor extends WorkerHost {
  private readonly logger = new Logger(IndexProcessor.name);

  constructor(private readonly pipeline: IndexPipeline) {
    super();
  }

  async process(job: Job<IndexJob>): Promise<{ documentId: string }> {
    const payload = job.data;
    await this.pipeline.run(
      payload.documentId,
      payload.versionId,
      payload.kbId,
      { bizId: payload.bizId },
    );
    return { documentId: payload.documentId };
  }
}
