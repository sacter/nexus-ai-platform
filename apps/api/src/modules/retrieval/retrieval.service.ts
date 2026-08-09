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

/** 检索结果缓存 TTL：5 分钟 */
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
   * ★ 检索管线主入口
   *
   * 流程:
   *   vector:  用户问题 → 向量化 → DenseRetriever → 引用生成 → 返回
   *   hybrid:  用户问题 → 向量化 → Dense + Sparse 双路召回 → RRF 融合 → 重排序(可选) → 引用生成 → 返回
   *
   * 缓存: Redis key = retrieval:{kbId}:{sha256(query+opts)}
   */
  async search(dto: SearchDto): Promise<SearchResponse> {
    // 1. 查询知识库并解析检索策略
    const kb = await this.prisma.knowledgeBase.findUnique({
      where: { id: dto.kbId },
      select: { id: true, retrievalStrategy: true, embeddingModel: true },
    });
    if (!kb) {
      throw new NotFoundException('知识库不存在');
    }

    const strategy =
      dto.strategy ?? (kb.retrievalStrategy as 'vector' | 'hybrid') ?? 'vector';

    // 2. 查 Redis 缓存
    const cacheKey = this.buildCacheKey(dto, strategy);
    try {
      const cached = await this.redis.get(cacheKey);
      if (cached) {
        this.logger.debug(`缓存命中: ${cacheKey}`);
        return JSON.parse(cached) as SearchResponse;
      }
    } catch (err) {
      this.logger.warn('Redis 读取失败，跳过缓存直接计算', err);
    }

    // 3. 用户问题向量化
    const { vector, model } = await this.embedding.embedQuery(dto.query, {
      modelName: kb.embeddingModel ?? undefined,
    });

    const topK = dto.topK ?? SEARCH_DEFAULTS.topK;

    let retrieveResults: RetrieveResult[];
    let totalCandidates: number;

    if (strategy === 'hybrid') {
      // ★ Hybird: 并行执行 Dense + Sparse 双路召回 → RRF 融合
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
              'SparseRetriever 检索失败，仅使用 Dense 路结果',
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
      // ★ Vector: 仅 DenseRetriever 向量检索
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

    // 4. 重排序（可选，hybrid 模式默认开启）
    const rerankEnabled = dto.rerank ?? strategy === 'hybrid';
    if (rerankEnabled && retrieveResults.length > 0) {
      const reranked = await this.applyReranker(
        dto.query,
        retrieveResults,
        topK,
      );
      if (reranked.length > 0) {
        retrieveResults = reranked;
      }
      // 优雅降级：若重排序返回空，保留原始结果
    }

    // 5. 取 topK + 构建引用
    const finalResults: SearchResult[] = retrieveResults
      .slice(0, topK)
      .map((r): SearchResult => ({
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
      }));

    const response: SearchResponse = {
      results: finalResults,
      strategy,
      totalCandidates,
    };

    // 6. 写入缓存（异步触发，不阻塞响应）
    this.redis
      .set(cacheKey, JSON.stringify(response), RETRIEVAL_CACHE_TTL)
      .catch((err) =>
        this.logger.warn('检索结果缓存写入失败', err),
      );

    return response;
  }

  /**
   * Parent-Child 双层分块解析（预留，待分块器支持后启用）
   *
   * 启用 parent-child chunking 后:
   * 1. 向量检索命中子 Chunk（高精度语义匹配）
   * 2. 通过 parent_chunk_id 反查父 Chunk（完整上下文）
   * 3. 按父 Chunk ID 去重 → 返回父 Chunk 内容作为 LLM 上下文
   *
   * 开关: parentChildEnabled 标志（默认 false）
   * 前提: 分块器需首先生成 Parent-Child 双层分块
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
   * 对候选列表应用重排序
   * 优先尝试 BGE（本地部署，速度更快），失败则回退到 Cohere
   * 任何异常返回空数组，调用方保留原始排序结果
   */
  private async applyReranker(
    query: string,
    candidates: RetrieveResult[],
    topK: number,
  ): Promise<RetrieveResult[]> {
    // 优先 BGE（本地部署，速度更快）
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

    // 回退到 Cohere
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
