import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database/prisma/prisma.service';
import {
  BaseRetriever,
  RetrieveParams,
  RetrieveResult,
} from './base-retriever';

@Injectable()
export class SparseRetriever extends BaseRetriever {
  readonly name = 'sparse';
  private readonly logger = new Logger(SparseRetriever.name);

  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async retrieve(params: RetrieveParams): Promise<RetrieveResult[]> {
    const { query, kbId, topK } = params;

    // PostgreSQL 全文搜索，使用 tsvector
    // 使用 'simple' 配置以兼容中英文混合场景
    // plainto_tsquery 将用户查询转换为 tsquery（& 连接）
    // ts_rank 按词频和邻近度计算相关性分数
    const sql = `
      SELECT
        dc.id                AS chunk_id,
        d.id                 AS document_id,
        d.name               AS document_name,
        dc.page              AS page,
        dc.content           AS content,
        dc.token_count       AS token_count,
        ts_rank(dc.tsv, plainto_tsquery('simple', $1)) AS score,
        dv.version_number    AS version_number
      FROM document_chunks dc
      JOIN document_versions dv ON dv.id = dc.version_id
      JOIN documents d ON d.id = dv.document_id
      WHERE dc.tsv IS NOT NULL
        AND dc.tsv @@ plainto_tsquery('simple', $1)
        AND d.kb_id = $2::uuid
        AND d.status NOT IN ('DELETED')
        AND d.current_version_id = dv.id
      ORDER BY score DESC
      LIMIT $3::integer
    `;

    try {
      const rows = await this.prisma.$queryRawUnsafe<
        {
          chunk_id: string;
          document_id: string;
          document_name: string;
          page: number;
          content: string;
          token_count: number;
          score: number;
          version_number: number;
        }[]
      >(sql, query, kbId, topK);

      return rows.map((row) => ({
        chunkId: row.chunk_id,
        documentId: row.document_id,
        documentName: row.document_name,
        page: row.page,
        content: row.content,
        tokenCount: Number(row.token_count),
        score: Number(row.score),
        versionNumber: row.version_number,
      }));
    } catch (error) {
      this.logger.error('SparseRetriever 全文搜索查询失败', error);
      throw error;
    }
  }
}
