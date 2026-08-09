import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database/prisma/prisma.service';
import { BaseRetriever, RetrieveParams, RetrieveResult } from './base-retriever';

@Injectable()
export class SparseRetriever extends BaseRetriever {
  readonly name = 'sparse';
  private readonly logger = new Logger(SparseRetriever.name);

  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async retrieve(params: RetrieveParams): Promise<RetrieveResult[]> {
    const { query, kbId, topK } = params;

    // PostgreSQL full-text search using tsvector
    // Uses 'simple' config for broad CJK compatibility
    // plainto_tsquery converts user query to tsquery with & operators
    // ts_rank scores by term frequency and proximity
    const sql = `
      SELECT
        dc.id                AS chunk_id,
        d.id                 AS document_id,
        d.name               AS document_name,
        dc.page              AS page,
        dc.content           AS content,
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
        score: Number(row.score),
        versionNumber: row.version_number,
      }));
    } catch (error) {
      this.logger.error('SparseRetriever query failed', error);
      throw error;
    }
  }
}
