import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@nexus/database';
import { PersistService } from './persist/persist.service';
import { IndexPipeline } from './index-pipeline';

/**
 * Reindex Pipeline —— 清空旧 chunks + 复用 IndexPipeline 重建
 */
@Injectable()
export class ReindexPipeline {
  private readonly logger = new Logger(ReindexPipeline.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly persist: PersistService,
    private readonly indexPipeline: IndexPipeline,
  ) {}

  async run(documentId: string, versionId: string, kbId: string) {
    // 清空旧 chunks（级联删向量）
    await this.persist.deleteChunksByVersion(versionId);
    await this.prisma.documentVersion.update({
      where: { id: versionId },
      data: { chunkCount: 0, status: 'PROCESSING' },
    });
    // 复用 Index Pipeline（reindex=true → job_type=REINDEX）
    const result = await this.indexPipeline.run(documentId, versionId, kbId, {
      reindex: true,
    });
    this.logger.log(
      `Reindex done: doc=${documentId}, chunks=${result.chunkCount}`,
    );
    return result;
  }
}
