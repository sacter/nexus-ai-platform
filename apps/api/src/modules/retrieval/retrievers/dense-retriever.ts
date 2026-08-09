import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database/prisma/prisma.service';
import {
  BaseRetriever,
  RetrieveParams,
  RetrieveResult,
} from './base-retriever';

@Injectable()
export class DenseRetriever extends BaseRetriever {
  readonly name = 'dense';
  private readonly logger = new Logger(DenseRetriever.name);

  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async retrieve(params: RetrieveParams): Promise<RetrieveResult[]> {
    const { queryVector, kbId, modelName, topK } = params;

    // pgvector 余弦距离：<=> 返回 [0, 2]，0 表示完全相同
    // 转换为相似度：1 - (distance)
    const sql = `
      SELECT
        dc.id                AS chunk_id,
        d.id                 AS document_id,
        d.name               AS document_name,
        dc.page              AS page,
        dc.content           AS content,
        1 - (ce.embedding <=> $1::vector) AS score,
        dv.version_number    AS version_number
      FROM chunk_embeddings ce
      JOIN document_chunks dc ON dc.id = ce.chunk_id
      JOIN document_versions dv ON dv.id = dc.version_id
      JOIN documents d ON d.id = dv.document_id
      WHERE ce.kb_id = $2::uuid
        AND ce.model_name = $3::varchar
        AND d.status NOT IN ('DELETED')
        AND d.current_version_id = dv.id
      ORDER BY ce.embedding <=> $1::vector
      LIMIT $4::integer
    `;

    try {
      const rows = await this.prisma.$queryRawUnsafe<
        {
          chunk_id: string;
          document_id: string;
          document_name: string;
          page: number;
          content: string;
          score: number;
          version_number: number;
        }[]
      >(sql, JSON.stringify(queryVector), kbId, modelName, topK);

      return rows.map((row) => ({
        chunkId: row.chunk_id,
        documentId: row.document_id,
        documentName: row.document_name,
        page: row.page,
        content: row.content,
        score: Number(row.score),
        versionNumber: row.version_number,
      }));
    } catch (error) {
      this.logger.error('DenseRetriever 向量检索查询失败', error);
      throw error;
    }
  }
}
