import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database/prisma/prisma.service';
import type { Prisma } from '@prisma/client';

export interface ListChunksQuery {
  documentId?: string;
  page?: number;
  pageSize?: number;
}

export interface ChunkListItem {
  id: string;
  documentId: string;
  documentName: string;
  versionId: string;
  page: number;
  chunkIndex: number;
  content: string;
  tokenCount: number;
  metadata: Prisma.JsonValue;
  parentChunkId: string | null;
  isEmbedded: boolean;
  embeddingModels: string[];
  createdAt: Date;
}

export interface ChunkListResult {
  items: ChunkListItem[];
  total: number;
  page: number;
  pageSize: number;
}

@Injectable()
export class ChunkService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * 查询知识库切片列表
   *
   * 口径：
   * - 只查当前活跃版本（document.currentVersionId）的切片，排除历史版本
   * - 排除 status = DELETED 的文档
   * - documentId 缺省时聚合库内全部非删除文档的活跃版本
   * - 向量化状态按当前页 chunkId 集合一次归组
   */
  async listChunks(kbId: string, query: ListChunksQuery): Promise<ChunkListResult> {
    const page =
      Number.isFinite(query.page) && query.page! >= 1 ? Math.floor(query.page!) : 1;
    const pageSize =
      Number.isFinite(query.pageSize) && query.pageSize! >= 1
        ? Math.min(100, Math.floor(query.pageSize!))
        : 20;

    // 1. 解析目标活跃版本 id 集合
    let versionIds: string[];
    if (query.documentId) {
      const doc = await this.prisma.document.findFirst({
        where: { id: query.documentId, kbId, status: { not: 'DELETED' } },
        select: { currentVersionId: true },
      });
      if (!doc?.currentVersionId) {
        return { items: [], total: 0, page, pageSize };
      }
      versionIds = [doc.currentVersionId];
    } else {
      const docs = await this.prisma.document.findMany({
        where: { kbId, status: { not: 'DELETED' } },
        select: { currentVersionId: true },
      });
      versionIds = docs
        .map((d) => d.currentVersionId)
        .filter((id): id is string => id !== null);
      if (versionIds.length === 0) {
        return { items: [], total: 0, page, pageSize };
      }
    }

    // 2. count + findMany（同一 where，事务内一致性）
    const where: Prisma.DocumentChunkWhereInput = { versionId: { in: versionIds } };
    const [total, chunks] = await this.prisma.$transaction([
      this.prisma.documentChunk.count({ where }),
      this.prisma.documentChunk.findMany({
        where,
        include: {
          version: {
            select: {
              document: { select: { id: true, name: true } },
            },
          },
        },
        orderBy: [
          { version: { documentId: 'asc' } },
          { page: 'asc' },
          { chunkIndex: 'asc' },
        ],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);

    // 3. 向量化状态归组（仅当前页 chunkId）
    const embRows = await this.prisma.chunkEmbedding.findMany({
      where: { chunkId: { in: chunks.map((c) => c.id) } },
      select: { chunkId: true, modelName: true },
    });
    const embMap = new Map<string, string[]>();
    for (const r of embRows) {
      const list = embMap.get(r.chunkId) ?? [];
      list.push(r.modelName);
      embMap.set(r.chunkId, list);
    }

    // 4. 组装
    const items: ChunkListItem[] = chunks.map((c) => {
      const models = embMap.get(c.id) ?? [];
      return {
        id: c.id,
        documentId: c.version.document.id,
        documentName: c.version.document.name,
        versionId: c.versionId,
        page: c.page,
        chunkIndex: c.chunkIndex,
        content: c.content,
        tokenCount: c.tokenCount,
        metadata: c.metadata,
        parentChunkId: c.parentChunkId,
        isEmbedded: models.length > 0,
        embeddingModels: models,
        createdAt: c.createdAt,
      };
    });

    return { items, total, page, pageSize };
  }
}
