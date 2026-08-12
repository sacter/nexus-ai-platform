import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@nexus/database';
import { IndexPipeline, IndexRunOpts } from './index-pipeline';

/**
 * Reindex Pipeline —— 复用 IndexPipeline 重建
 *
 * ★ 幂等与原子性：
 * - 不再先删旧 chunks 再重建（旧实现删除与重建分两步，重建失败会丢数据）
 * - 重建全部委托给 IndexPipeline：bizId=versionId 幂等抢占防重复，
 *   同一事务内先删旧 chunks 再插新 chunks，失败不产生数据丢失窗口
 */
@Injectable()
export class ReindexPipeline {
  private readonly logger = new Logger(ReindexPipeline.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly indexPipeline: IndexPipeline,
  ) {}

  async run(
    documentId: string,
    versionId: string,
    kbId: string,
    opts?: Pick<IndexRunOpts, 'bizId'>,
  ) {
    // 反馈信号：重建期间版本回到处理中（供前端展示）
    await this.prisma.documentVersion.update({
      where: { id: versionId },
      data: { status: 'PROCESSING' },
    });
    // 复用 Index Pipeline（reindex=true → job_type=REINDEX）
    const result = await this.indexPipeline.run(documentId, versionId, kbId, {
      reindex: true,
      bizId: opts?.bizId ?? versionId,
    });
    this.logger.log(
      `Reindex done: doc=${documentId}, chunks=${result.chunkCount}${result.idempotent ? ' (幂等跳过)' : ''}`,
    );
    return result;
  }
}
