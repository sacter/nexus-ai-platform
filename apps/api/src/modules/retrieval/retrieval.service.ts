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
    const t0 = Date.now();

    // 1. 查询知识库并解析检索策略
    let t = Date.now();
    const kb = await this.prisma.knowledgeBase.findUnique({
      where: { id: dto.kbId },
      select: { id: true, retrievalStrategy: true, embeddingModel: true },
    });
    if (!kb) {
      throw new NotFoundException('知识库不存在');
    }
    this.logger.log(`[计时] 1. KB查询: ${Date.now() - t}ms`);

    const strategy =
      dto.strategy ?? (kb.retrievalStrategy as 'vector' | 'hybrid') ?? 'vector';

    // 2. 查 Redis 缓存
    t = Date.now();
    const cacheKey = this.buildCacheKey(dto, strategy);
    try {
      const cached = await this.redis.get(cacheKey);
      if (cached) {
        this.logger.log(`[计时] 缓存命中: ${Date.now() - t0}ms (总耗时)`);
        return JSON.parse(cached) as SearchResponse;
      }
    } catch (err) {
      this.logger.warn('Redis 读取失败，跳过缓存直接计算', err);
    }
    this.logger.log(`[计时] 2. Redis缓存查询: ${Date.now() - t}ms`);

    // 3. 用户问题向量化
    t = Date.now();
    const { vector, model } = await this.embedding.embedQuery(dto.query, {
      modelName: kb.embeddingModel ?? undefined,
    });
    this.logger.log(
      `[计时] 3. Embedding向量化: ${Date.now() - t}ms (模型=${model}, 维度=${vector.length})`,
    );

    const topK = dto.topK ?? SEARCH_DEFAULTS.topK;

    let retrieveResults: RetrieveResult[];
    let totalCandidates: number;

    if (strategy === 'hybrid') {
      // ★ Hybird: 并行执行 Dense + Sparse 双路召回 → RRF 融合
      const denseTopK = dto.denseTopK ?? SEARCH_DEFAULTS.denseTopK;
      const sparseTopK = dto.sparseTopK ?? SEARCH_DEFAULTS.sparseTopK;

      t = Date.now();
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
      this.logger.log(
        `[计时] 4a. 双路召回: ${Date.now() - t}ms (Dense=${denseResults.length}, Sparse=${sparseResults.length})`,
      );

      // ★ RRF 融合阶段留足够候选给 reranker：使用 denseTopK 而非 SEARCH_DEFAULTS.topK(5)
      t = Date.now();
      const fused = this.rrf.fuse(
        denseResults,
        sparseResults,
        undefined,
        denseTopK,
      );
      this.logger.log(
        `[计时] 4b. RRF融合: ${Date.now() - t}ms (融合后=${fused.length})`,
      );

      retrieveResults = fused.map((f) => ({
        chunkId: f.chunkId,
        documentId: f.documentId,
        documentName: f.documentName,
        page: f.page,
        content: f.content,
        score: f.score,
        tokenCount: f.tokenCount,
        versionNumber: f.versionNumber,
      }));

      totalCandidates = fused.length;
    } else {
      // ★ Vector: 仅 DenseRetriever 向量检索
      const denseTopK = dto.denseTopK ?? SEARCH_DEFAULTS.denseTopK;
      t = Date.now();
      retrieveResults = await this.denseRetriever.retrieve({
        query: dto.query,
        queryVector: vector,
        kbId: dto.kbId,
        modelName: model,
        topK: denseTopK,
      });
      this.logger.log(
        `[计时] 4. DenseRetriever: ${Date.now() - t}ms (结果=${retrieveResults.length})`,
      );

      totalCandidates = retrieveResults.length;
    }

    // 4. 重排序（默认开启，本地 BGE Reranker 提升精度）
    //    先截断送给 reranker 的候选数，避免 CPU 推理耗时过长（每条文档 ~2s）
    const rerankEnabled = dto.rerank ?? true;
    if (rerankEnabled && retrieveResults.length > 0) {
      // ★ 只把 topK×3 条粗排候选送进 reranker，在精度与延迟间取平衡
      const rerankCandidateLimit = Math.min(retrieveResults.length, topK * 3);
      const rerankCandidates = retrieveResults.slice(0, rerankCandidateLimit);

      t = Date.now();
      const reranked = await this.applyReranker(
        dto.query,
        rerankCandidates,
        topK,
      );
      this.logger.log(
        `[计时] 5. Reranker: ${Date.now() - t}ms (输入=${retrieveResults.length}, 输出=${reranked.length})`,
      );
      if (reranked.length > 0) {
        retrieveResults = reranked;
      } else {
        this.logger.warn(
          'Reranker 返回空结果，使用原始检索结果（分数可能偏低）',
        );
      }
    }

    // 5. 过滤低相关度碎片 + 取 topK + 构建引用
    t = Date.now();
    const MIN_SCORE_THRESHOLD = 0.1;
    const finalResults: SearchResult[] = retrieveResults
      .filter((r) => r.score >= MIN_SCORE_THRESHOLD)
      .slice(0, topK)
      .map((r): SearchResult => ({
        chunkId: r.chunkId,
        documentId: r.documentId,
        documentName: r.documentName,
        page: r.page,
        content: r.content,
        score: r.score,
        tokenCount: r.tokenCount,
        citation: this.citation.buildCitation({
          documentName: r.documentName,
          page: r.page,
          versionNumber: r.versionNumber,
          content: r.content,
        }),
      }));
    this.logger.log(
      `[计时] 6. 引用构建+过滤: ${Date.now() - t}ms (最终=${finalResults.length})`,
    );

    const response: SearchResponse = {
      results: finalResults,
      strategy,
      totalCandidates,
    };

    this.logger.log(
      `[计时] ★ 总耗时: ${Date.now() - t0}ms (策略=${strategy}, topK=${topK})`,
    );

    // 7. 写入缓存（异步触发，不阻塞响应）
    this.redis
      .set(cacheKey, JSON.stringify(response), RETRIEVAL_CACHE_TTL)
      .catch((err) => this.logger.warn('检索结果缓存写入失败', err));

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
      tokenCount: 0,
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
    const tBge = Date.now();
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
    this.logger.log(
      `[计时]   ├ BGE Reranker: ${Date.now() - tBge}ms (结果=${bgeResults.length})`,
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
    const tCohere = Date.now();
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
    this.logger.log(
      `[计时]   ├ Cohere Reranker: ${Date.now() - tCohere}ms (结果=${cohereResults.length})`,
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
