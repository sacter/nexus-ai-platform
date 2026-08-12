import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../../../infrastructure/database/prisma/prisma.service';
import { SplitChunk } from '../splitters/splitter.interface';
import { toChunkRows } from './batch-writer';

/**
 * 持久化服务 —— 落库 document_chunks 与 chunk_embeddings
 */
@Injectable()
export class PersistService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * 批量写入 chunks
   * @param tx 可选事务客户端 —— IndexPipeline 在持久化段传入 $transaction 的 tx，
   *           保证 chunks 与版本统计在同个事务内原子提交
   */
  async saveChunks(
    versionId: string,
    chunks: SplitChunk[],
    tx?: Prisma.TransactionClient | PrismaService,
  ) {
    if (chunks.length === 0) return { count: 0, ids: [] as string[] };
    const client = tx ?? this.prisma;
    const rows = toChunkRows(versionId, chunks);
    const created = await client.documentChunk.createMany({ data: rows });
    // 回查刚写入的 id（createMany 不返回 id，按 versionId + chunkIndex 定位）
    const saved = await client.documentChunk.findMany({
      where: { versionId },
      select: { id: true },
      orderBy: { chunkIndex: 'asc' },
    });
    return { count: created.count, ids: saved.map((s) => s.id) };
  }

  /**
   * 写入单条向量（原生 SQL，vector 类型 Prisma 不支持）
   * ON CONFLICT (chunk_id, model_name) DO NOTHING 幂等
   */
  async saveEmbedding(
    chunkId: string,
    kbId: string,
    modelName: string,
    vector: number[],
  ) {
    await this.prisma.$executeRaw`
      INSERT INTO chunk_embeddings (chunk_id, model_name, kb_id, embedding)
      VALUES (${chunkId}::uuid, ${modelName}::varchar, ${kbId}::uuid, ${JSON.stringify(vector)}::vector)
      ON CONFLICT (chunk_id, model_name) DO NOTHING
    `;
  }

  /** 批量写入向量 */
  async saveEmbeddings(
    rows: Array<{
      chunkId: string;
      kbId: string;
      modelName: string;
      vector: number[];
    }>,
  ) {
    for (const row of rows) {
      await this.saveEmbedding(
        row.chunkId,
        row.kbId,
        row.modelName,
        row.vector,
      );
    }
  }

  /** 删除某版本全部 chunks（级联删向量） */
  async deleteChunksByVersion(versionId: string) {
    return this.prisma.documentChunk.deleteMany({ where: { versionId } });
  }

  /** 删除文档全部 chunks（级联删向量） */
  async deleteChunksByDocument(documentId: string) {
    return this.prisma.documentChunk.deleteMany({
      where: { version: { documentId } },
    });
  }
}
