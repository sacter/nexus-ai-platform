import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { createHash } from 'crypto';
import { PrismaService } from '../../infrastructure/database/prisma/prisma.service';
import { EmbeddingService } from '../embedding/embedding.service';
import { RedisService } from '../../infrastructure/redis/redis.service';
import { DenseRetriever } from './retrievers/dense-retriever';
import { SparseRetriever } from './retrievers/sparse-retriever';
import { RrfService } from './fusion/rrf.service';
import { BgeRerankerService } from './reranker/bge-reranker.service';
import { CohereRerankerService } from './reranker/cohere-reranker.service';
import { CitationService } from './citation/citation.service';
import {
  SearchDto,
  SearchResponse,
  SearchResult,
  SEARCH_DEFAULTS,
} from './dto/search.dto';
import { RetrieveResult } from './retrievers/base-retriever';

/** Retrieval cache TTL: 5min */
const RETRIEVAL_CACHE_TTL = 60 * 5;

@Injectable()
export class RetrievalService {
  private readonly logger = new Logger(RetrievalService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly embedding: EmbeddingService,
    private readonly redis: RedisService,
    private readonly denseRetriever: DenseRetriever,
    private readonly sparseRetriever: SparseRetriever,
    private readonly rrf: RrfService,
    private readonly bgeReranker: BgeRerankerService,
    private readonly cohereReranker: CohereRerankerService,
    private readonly citation: CitationService,
  ) {}

  /**
   * Retrieval Pipeline main entry point
   *
   * Flow:
   *   vector:  Query -> Embedding -> DenseRetriever -> Citation -> Return
   *   hybrid:  Query -> Embedding -> Dense + Sparse -> RRF -> Reranker(optional) -> Citation -> Return
   *
   * Cache: Redis key = retrieval:{kbId}:{sha256(query+opts)}
   */
  async search(dto: SearchDto): Promise<SearchResponse> {
    // 1. Resolve KB and strategy
    const kb = await this.prisma.knowledgeBase.findUnique({
      where: { id: dto.kbId },
      select: { id: true, retrievalStrategy: true, embeddingModel: true },
    });
    if (!kb) {
      throw new NotFoundException('Knowledge base not found');
    }

    const strategy =
      dto.strategy ??
      (kb.retrievalStrategy as 'vector' | 'hybrid') ??
      'vector';

    // 2. Check cache
    const cacheKey = this.buildCacheKey(dto, strategy);
    try {
      const cached = await this.redis.get(cacheKey);
      if (cached) {
        this.logger.debug(`Cache hit: ${cacheKey}`);
        return JSON.parse(cached) as SearchResponse;
      }
    } catch (err) {
      this.logger.warn('Redis get failed, computing without cache', err);
    }

    // 3. Embed query
    const { vector, model } = await this.embedding.embedQuery(dto.query, {
      modelName: kb.embeddingModel ?? undefined,
    });

    const topK = dto.topK ?? SEARCH_DEFAULTS.topK;

    let retrieveResults: RetrieveResult[];
    let totalCandidates: number;

    if (strategy === 'hybrid') {
      // Hybrid: parallel dense + sparse -> RRF
      const denseTopK = dto.denseTopK ?? SEARCH_DEFAULTS.denseTopK;
      const sparseTopK = dto.sparseTopK ?? SEARCH_DEFAULTS.sparseTopK;

      const [denseResults, sparseResults] = await Promise.all([
        this.denseRetriever.retrieve({
          query: dto.query,
          queryVector: vector,
          kbId: dto.kbId,
          modelName: model,
          topK: denseTopK,
        }),
        this.sparseRetriever
          .retrieve({
            query: dto.query,
            queryVector: vector,
            kbId: dto.kbId,
            modelName: model,
            topK: sparseTopK,
          })
          .catch((err) => {
            this.logger.warn(
              'Sparse retriever failed, continuing with dense only',
              err,
            );
            return [] as RetrieveResult[];
          }),
      ]);

      const fused = this.rrf.fuse(denseResults, sparseResults);

      retrieveResults = fused.map((f) => ({
        chunkId: f.chunkId,
        documentId: f.documentId,
        documentName: f.documentName,
        page: f.page,
        content: f.content,
        score: f.score,
        versionNumber: f.versionNumber,
      }));

      totalCandidates = fused.length;
    } else {
      // Vector only: DenseRetriever
      const denseTopK = dto.denseTopK ?? SEARCH_DEFAULTS.denseTopK;
      retrieveResults = await this.denseRetriever.retrieve({
        query: dto.query,
        queryVector: vector,
        kbId: dto.kbId,
        modelName: model,
        topK: denseTopK,
      });

      totalCandidates = retrieveResults.length;
    }

    // 4. Reranker (optional, default enabled for hybrid)
    const rerankEnabled = dto.rerank ?? (strategy === 'hybrid');
    if (rerankEnabled && retrieveResults.length > 0) {
      const reranked = await this.applyReranker(
        dto.query,
        retrieveResults,
        topK,
      );
      if (reranked.length > 0) {
        retrieveResults = reranked;
      }
      // Graceful degradation: if reranker returns empty, keep original results
    }

    // 5. Take topK + build citations
    const finalResults: SearchResult[] = retrieveResults
      .slice(0, topK)
      .map(
        (r): SearchResult => ({
          chunkId: r.chunkId,
          documentId: r.documentId,
          documentName: r.documentName,
          page: r.page,
          content: r.content,
          score: r.score,
          citation: this.citation.buildCitation({
            documentName: r.documentName,
            page: r.page,
            versionNumber: r.versionNumber,
            content: r.content,
          }),
        }),
      );

    const response: SearchResponse = {
      results: finalResults,
      strategy,
      totalCandidates,
    };

    // 6. Populate cache (fire-and-forget)
    this.redis
      .set(cacheKey, JSON.stringify(response), RETRIEVAL_CACHE_TTL)
      .catch((err) =>
        this.logger.warn('Failed to cache retrieval result', err),
      );

    return response;
  }

  /**
   * Parent-Child Chunk Resolution (reserved for future use)
   *
   * When parent-child chunking is enabled:
   * 1. Retrieve child chunks (high precision vector match)
   * 2. Resolve parent_chunk_id -> get parent chunks (full context)
   * 3. Deduplicate by parent ID -> return parent content
   *
   * Gate: parentChildEnabled flag (default false).
   * Requires splitter to generate parent-child chunks first.
   */
  async resolveParentChunks(
    childResults: RetrieveResult[],
  ): Promise<RetrieveResult[]> {
    const childChunkIds = childResults.map((r) => r.chunkId);

    if (childChunkIds.length === 0) return [];

    const parents = await this.prisma.$queryRawUnsafe<
      {
        chunk_id: string;
        document_id: string;
        document_name: string;
        page: number;
        content: string;
        version_number: number;
      }[]
    >(
      `SELECT DISTINCT ON (dc_parent.id)
         dc_parent.id           AS chunk_id,
         d.id                   AS document_id,
         d.name                 AS document_name,
         dc_parent.page         AS page,
         dc_parent.content      AS content,
         dv.version_number      AS version_number
       FROM document_chunks dc_child
       JOIN document_chunks dc_parent ON dc_parent.id = dc_child.parent_chunk_id
       JOIN document_versions dv ON dv.id = dc_parent.version_id
       JOIN documents d ON d.id = dv.document_id
       WHERE dc_child.id = ANY($1::uuid[])
         AND dc_child.parent_chunk_id IS NOT NULL`,
      childChunkIds,
    );

    return parents.map((row) => ({
      chunkId: row.chunk_id,
      documentId: row.document_id,
      documentName: row.document_name,
      page: row.page,
      content: row.content,
      score: 0,
      versionNumber: row.version_number,
    }));
  }

  private buildCacheKey(dto: SearchDto, strategy: string): string {
    const payload = JSON.stringify({
      q: dto.query,
      k: dto.kbId,
      s: strategy,
      tk: dto.topK,
      dtk: dto.denseTopK,
      stk: dto.sparseTopK,
      r: dto.rerank,
    });
    const hash = createHash('sha256').update(payload).digest('hex');
    return `retrieval:${dto.kbId}:${hash}`;
  }

  /**
   * Apply reranker to current candidate list.
   * Tries BGE first (local deployment, faster), falls back to Cohere if configured.
   * On any failure, returns empty array (caller keeps original results).
   */
  private async applyReranker(
    query: string,
    candidates: RetrieveResult[],
    topK: number,
  ): Promise<RetrieveResult[]> {
    // Try BGE first (local, faster)
    const bgeResults = await this.bgeReranker.rerank(
      {
        query,
        documents: candidates.map((c) => ({
          chunkId: c.chunkId,
          content: c.content,
        })),
      },
      topK,
    );

    if (bgeResults.length > 0) {
      const rerankMap = new Map(
        bgeResults.map((r) => [r.chunkId, r.relevanceScore]),
      );
      return candidates
        .filter((c) => rerankMap.has(c.chunkId))
        .map((c) => ({ ...c, score: rerankMap.get(c.chunkId)! }))
        .sort((a, b) => b.score - a.score);
    }

    // Fallback to Cohere
    const cohereResults = await this.cohereReranker.rerank(
      {
        query,
        documents: candidates.map((c) => ({
          chunkId: c.chunkId,
          content: c.content,
        })),
      },
      topK,
    );

    if (cohereResults.length > 0) {
      const rerankMap = new Map(
        cohereResults.map((r) => [r.chunkId, r.relevanceScore]),
      );
      return candidates
        .filter((c) => rerankMap.has(c.chunkId))
        .map((c) => ({ ...c, score: rerankMap.get(c.chunkId)! }))
        .sort((a, b) => b.score - a.score);
    }

    return [];
  }
}
