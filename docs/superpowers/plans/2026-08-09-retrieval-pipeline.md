# Retrieval Pipeline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement a layered Retrieval Pipeline module that performs Vector Search (pgvector HNSW) and Hybrid Search (BM25 tsvector + RRF fusion) with optional reranking and citation generation.

**Architecture:** 12 new files in `apps/api/src/modules/retrieval/` following the CLAUDE.md spec. The pipeline is RetrievalService (orchestrator) → DenseRetriever + SparseRetriever → RrfService → Reranker → CitationService. Each layer has a swappable interface. Raw SQL for vector/tsvector queries. One-line registration in app.module.ts.

**Tech Stack:** NestJS, Prisma (PostgreSQL + pgvector), Redis (ioredis), class-validator

---

## File Structure

| File | Responsibility |
|------|---------------|
| `dto/search.dto.ts` | Request validation + response types |
| `retrievers/base-retriever.ts` | Abstract retriever interface |
| `retrievers/dense-retriever.ts` | pgvector `<=>` cosine similarity search |
| `retrievers/sparse-retriever.ts` | PostgreSQL `tsvector` full-text search (BM25-like) |
| `fusion/rrf.service.ts` | Reciprocal Rank Fusion — merge + dedup ranked lists |
| `reranker/reranker.interface.ts` | Reranker provider interface |
| `reranker/bge-reranker.service.ts` | BGE-Reranker HTTP API caller |
| `reranker/cohere-reranker.service.ts` | Cohere Rerank HTTP API caller |
| `citation/citation.service.ts` | Build citation objects from chunk metadata |
| `retrieval.service.ts` | Orchestrator: embed → retrieve → fuse → rerank → cite |
| `retrieval.controller.ts` | Thin REST controller: `POST /retrieval/search` |
| `retrieval.module.ts` | NestJS module registration |
| `app.module.ts` (modify) | Add `RetrievalModule` to imports |

---

### Task 1: Search DTO — Data Contract

**Files:**
- Create: `apps/api/src/modules/retrieval/dto/search.dto.ts`

- [ ] **Step 1: Write search DTO with validation and response types**

```typescript
import {
  IsString,
  IsUUID,
  IsOptional,
  IsInt,
  IsBoolean,
  IsIn,
  Min,
  Max,
  IsNotEmpty,
} from 'class-validator';

// ── Request ──

export class SearchDto {
  @IsString()
  @IsNotEmpty()
  query!: string;

  @IsUUID('4')
  kbId!: string;

  @IsOptional()
  @IsIn(['vector', 'hybrid'])
  strategy?: 'vector' | 'hybrid';

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  topK?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(200)
  denseTopK?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(200)
  sparseTopK?: number;

  @IsOptional()
  @IsBoolean()
  rerank?: boolean;
}

// ── Response ──

export interface Citation {
  documentName: string;
  page: number;
  version: string;
  snippet: string;
}

export interface SearchResult {
  chunkId: string;
  documentId: string;
  documentName: string;
  page: number;
  content: string;
  score: number;
  citation: Citation;
}

export interface SearchResponse {
  results: SearchResult[];
  strategy: 'vector' | 'hybrid';
  totalCandidates: number;
}

// ── Defaults (from CLAUDE.md section 2.3) ──

export const SEARCH_DEFAULTS = {
  denseTopK: 20,
  sparseTopK: 20,
  rrfK: 60,
  topK: 5,
  rerankTopK: 5,
} as const;
```

- [ ] **Step 2: Commit**

```bash
git add apps/api/src/modules/retrieval/dto/search.dto.ts
git commit -m "feat(retrieval): add SearchDto and response types"
```

---

### Task 2: Base Retriever — Abstract Interface

**Files:**
- Create: `apps/api/src/modules/retrieval/retrievers/base-retriever.ts`

- [ ] **Step 1: Write abstract base retriever class**

```typescript
import { SearchResult } from '../dto/search.dto';

export interface RetrieveParams {
  query: string;
  queryVector: number[];
  kbId: string;
  modelName: string;
  topK: number;
}

export interface RetrieveResult {
  chunkId: string;
  documentId: string;
  documentName: string;
  page: number;
  content: string;
  score: number;
  versionNumber: number;
}

export abstract class BaseRetriever {
  abstract readonly name: string;

  abstract retrieve(params: RetrieveParams): Promise<RetrieveResult[]>;
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/api/src/modules/retrieval/retrievers/base-retriever.ts
git commit -m "feat(retrieval): add BaseRetriever abstract class"
```

---

### Task 3: RRF Fusion Service

**Files:**
- Create: `apps/api/src/modules/retrieval/fusion/rrf.service.ts`

- [ ] **Step 1: Write RRF fusion service (pure function)**

```typescript
import { Injectable } from '@nestjs/common';
import { RetrieveResult } from '../retrievers/base-retriever';
import { SEARCH_DEFAULTS } from '../dto/search.dto';

export interface RrfFusedResult {
  chunkId: string;
  documentId: string;
  documentName: string;
  page: number;
  content: string;
  score: number; // RRF score
  versionNumber: number;
  denseRank: number | null;
  sparseRank: number | null;
}

@Injectable()
export class RrfService {
  /**
   * Reciprocal Rank Fusion
   *
   * score(d) = Σ 1/(k + rank_i(d))
   *
   * - k=60 (default) smooths the rank penalty
   * - Ranks are 1-indexed
   * - Deduplicates by chunkId, sums scores from both retrievers
   * - Falls back to single-list if either input is empty
   */
  fuse(
    denseResults: RetrieveResult[],
    sparseResults: RetrieveResult[],
    k: number = SEARCH_DEFAULTS.rrfK,
    topK: number = SEARCH_DEFAULTS.topK,
  ): RrfFusedResult[] {
    const scoreMap = new Map<
      string,
      {
        item: RetrieveResult;
        denseRank: number | null;
        sparseRank: number | null;
        rrfScore: number;
      }
    >();

    // Helper: add scores from one ranked list
    const addScores = (
      results: RetrieveResult[],
      rankKey: 'denseRank' | 'sparseRank',
    ) => {
      for (let i = 0; i < results.length; i++) {
        const rank = i + 1; // 1-indexed
        const existing = scoreMap.get(results[i].chunkId);
        const contrib = 1 / (k + rank);

        if (existing) {
          existing.rrfScore += contrib;
          existing[rankKey] = rank;
        } else {
          scoreMap.set(results[i].chunkId, {
            item: results[i],
            denseRank: null,
            sparseRank: null,
            rrfScore: contrib,
          });
          scoreMap.get(results[i].chunkId)![rankKey] = rank;
        }
      }
    };

    addScores(denseResults, 'denseRank');
    addScores(sparseResults, 'sparseRank');

    // Sort by RRF score descending, take topK
    const fused: RrfFusedResult[] = Array.from(scoreMap.values())
      .sort((a, b) => b.rrfScore - a.rrfScore)
      .slice(0, topK)
      .map((entry) => ({
        chunkId: entry.item.chunkId,
        documentId: entry.item.documentId,
        documentName: entry.item.documentName,
        page: entry.item.page,
        content: entry.item.content,
        score: Math.round(entry.rrfScore * 1e6) / 1e6, // round to 6 decimal places
        versionNumber: entry.item.versionNumber,
        denseRank: entry.denseRank,
        sparseRank: entry.sparseRank,
      }));

    return fused;
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/api/src/modules/retrieval/fusion/rrf.service.ts
git commit -m "feat(retrieval): add RrfService for Reciprocal Rank Fusion"
```

---

### Task 4: Dense Retriever — pgvector HNSW

**Files:**
- Create: `apps/api/src/modules/retrieval/retrievers/dense-retriever.ts`

- [ ] **Step 1: Write DenseRetriever with raw SQL pgvector cosine similarity**

```typescript
import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database/prisma/prisma.service';
import { BaseRetriever, RetrieveParams, RetrieveResult } from './base-retriever';

@Injectable()
export class DenseRetriever extends BaseRetriever {
  readonly name = 'dense';
  private readonly logger = new Logger(DenseRetriever.name);

  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async retrieve(params: RetrieveParams): Promise<RetrieveResult[]> {
    const { queryVector, kbId, modelName, topK } = params;

    // pgvector cosine distance: <=> returns [0, 2], 0 = identical
    // Convert to similarity: 1 - (distance)
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
      this.logger.error('DenseRetriever query failed', error);
      throw error;
    }
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/api/src/modules/retrieval/retrievers/dense-retriever.ts
git commit -m "feat(retrieval): add DenseRetriever with pgvector cosine similarity"
```

---

### Task 5: Sparse Retriever — BM25 via tsvector

**Files:**
- Create: `apps/api/src/modules/retrieval/retrievers/sparse-retriever.ts`

- [ ] **Step 1: Write SparseRetriever with PostgreSQL full-text search**

```typescript
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
```

- [ ] **Step 2: Commit**

```bash
git add apps/api/src/modules/retrieval/retrievers/sparse-retriever.ts
git commit -m "feat(retrieval): add SparseRetriever with PostgreSQL tsvector BM25"
```

---

### Task 6: Reranker Interface + BGE + Cohere Implementations

**Files:**
- Create: `apps/api/src/modules/retrieval/reranker/reranker.interface.ts`
- Create: `apps/api/src/modules/retrieval/reranker/bge-reranker.service.ts`
- Create: `apps/api/src/modules/retrieval/reranker/cohere-reranker.service.ts`

- [ ] **Step 1: Write reranker interface**

```typescript
export interface RerankInput {
  query: string;
  documents: {
    chunkId: string;
    content: string;
  }[];
}

export interface RerankOutput {
  chunkId: string;
  relevanceScore: number; // normalized [0, 1], higher = more relevant
}

export interface Reranker {
  readonly name: string;
  rerank(input: RerankInput, topK?: number): Promise<RerankOutput[]>;
}
```

- [ ] **Step 2: Write BGE reranker service**

```typescript
import { Injectable, Logger } from '@nestjs/common';
import { Reranker, RerankInput, RerankOutput } from './reranker.interface';

interface BgeRerankerConfig {
  baseUrl: string;
  apiKey?: string;
  model: string;
}

@Injectable()
export class BgeRerankerService implements Reranker {
  readonly name = 'bge-reranker';
  private readonly logger = new Logger(BgeRerankerService.name);

  private readonly config: BgeRerankerConfig = {
    baseUrl: process.env.BGE_RERANKER_BASE_URL ?? 'http://localhost:8080',
    model: process.env.BGE_RERANKER_MODEL ?? 'bge-reranker-v2-m3',
  };

  async rerank(input: RerankInput, topK = 5): Promise<RerankOutput[]> {
    const url = `${this.config.baseUrl}/rerank`;

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(this.config.apiKey
            ? { Authorization: `Bearer ${this.config.apiKey}` }
            : {}),
        },
        body: JSON.stringify({
          query: input.query,
          documents: input.documents.map((d) => d.content),
          model: this.config.model,
          top_k: topK,
        }),
      });

      if (!response.ok) {
        this.logger.warn(
          `BGE Reranker returned ${response.status}, skipping rerank`,
        );
        return [];
      }

      const data = (await response.json()) as {
        results: { index: number; relevance_score: number }[];
      };

      return data.results.map((r) => ({
        chunkId: input.documents[r.index].chunkId,
        relevanceScore: r.relevance_score,
      }));
    } catch (error) {
      this.logger.warn('BGE Reranker call failed, skipping rerank', error);
      return [];
    }
  }
}
```

- [ ] **Step 3: Write Cohere reranker service**

```typescript
import { Injectable, Logger } from '@nestjs/common';
import { Reranker, RerankInput, RerankOutput } from './reranker.interface';

@Injectable()
export class CohereRerankerService implements Reranker {
  readonly name = 'cohere-rerank';
  private readonly logger = new Logger(CohereRerankerService.name);

  private readonly config = {
    apiKey: process.env.COHERE_API_KEY ?? '',
    baseUrl: process.env.COHERE_BASE_URL ?? 'https://api.cohere.com/v1',
    model: process.env.COHERE_RERANK_MODEL ?? 'rerank-english-v3.0',
  };

  async rerank(input: RerankInput, topK = 5): Promise<RerankOutput[]> {
    if (!this.config.apiKey) {
      this.logger.warn('Cohere API key not configured, skipping rerank');
      return [];
    }

    const url = `${this.config.baseUrl}/rerank`;

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.config.apiKey}`,
        },
        body: JSON.stringify({
          model: this.config.model,
          query: input.query,
          documents: input.documents.map((d) => d.content),
          top_n: topK,
        }),
      });

      if (!response.ok) {
        this.logger.warn(
          `Cohere Rerank returned ${response.status}, skipping rerank`,
        );
        return [];
      }

      const data = (await response.json()) as {
        results: { index: number; relevance_score: number }[];
      };

      return data.results.map((r) => ({
        chunkId: input.documents[r.index].chunkId,
        relevanceScore: r.relevance_score,
      }));
    } catch (error) {
      this.logger.warn('Cohere Rerank call failed, skipping rerank', error);
      return [];
    }
  }
}
```

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/modules/retrieval/reranker/
git commit -m "feat(retrieval): add Reranker interface + BGE/Cohere implementations"
```

---

### Task 7: Citation Service

**Files:**
- Create: `apps/api/src/modules/retrieval/citation/citation.service.ts`

- [ ] **Step 1: Write citation service**

```typescript
import { Injectable } from '@nestjs/common';
import { Citation } from '../dto/search.dto';

export interface CitationInput {
  documentName: string;
  page: number;
  versionNumber: number;
  content: string;
}

@Injectable()
export class CitationService {
  /**
   * Build citation objects from chunk metadata.
   *
   * Snippet: first ~200 characters of content for preview.
   * Version: formatted as "v{versionNumber}".
   */
  buildCitation(input: CitationInput): Citation {
    const snippet =
      input.content.length > 200
        ? input.content.substring(0, 200) + '...'
        : input.content;

    return {
      documentName: input.documentName,
      page: input.page,
      version: `v${input.versionNumber}`,
      snippet,
    };
  }

  buildCitations(inputs: CitationInput[]): Citation[] {
    return inputs.map((input) => this.buildCitation(input));
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/api/src/modules/retrieval/citation/citation.service.ts
git commit -m "feat(retrieval): add CitationService"
```

---

### Task 8: Retrieval Service — Pipeline Orchestrator

**Files:**
- Create: `apps/api/src/modules/retrieval/retrieval.service.ts`

- [ ] **Step 1: Write RetrievalService orchestrator**

```typescript
import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { createHash } from 'crypto';
import { PrismaService } from '../../infrastructure/database/prisma/prisma.service';
import { EmbeddingService } from '../embedding/embedding.service';
import { RedisService } from '../../infrastructure/redis/redis.service';
import { DenseRetriever } from './retrievers/dense-retriever';
import { SparseRetriever } from './retrievers/sparse-retriever';
import { RrfService, RrfFusedResult } from './fusion/rrf.service';
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

/** Retrieval 结果缓存 TTL：5min */
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
   * ★ Retrieval Pipeline 主入口
   *
   * 流程:
   *   vector:  Query → Embedding → DenseRetriever → Citation → Return
   *   hybrid:  Query → Embedding → Dense + Sparse → RRF → Reranker(optional) → Citation → Return
   *
   * 缓存: Redis key = retrieval:{kbId}:{sha256(query+opts)}
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

    const strategy = dto.strategy ?? (kb.retrievalStrategy as 'vector' | 'hybrid') ?? 'vector';

    // 2. Check cache
    const cacheKey = this.buildCacheKey(dto, strategy);
    const cached = await this.redis.get(cacheKey);
    if (cached) {
      return JSON.parse(cached) as SearchResponse;
    }

    // 3. Embed query
    const { vector, model } = await this.embedding.embedQuery(dto.query, {
      modelName: kb.embeddingModel ?? undefined,
    });

    const topK = dto.topK ?? SEARCH_DEFAULTS.topK;

    let retrieveResults: RetrieveResult[];
    let rerankInputs: { chunkId: string; content: string; score: number }[];

    if (strategy === 'hybrid') {
      // ★ Hybrid: parallel dense + sparse → RRF
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
        this.sparseRetriever.retrieve({
          query: dto.query,
          queryVector: vector, // not used by sparse
          kbId: dto.kbId,
          modelName: model,
          topK: sparseTopK,
        }).catch((err) => {
          this.logger.warn('Sparse retriever failed, continuing with dense only', err);
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

      rerankInputs = fused.map((f) => ({
        chunkId: f.chunkId,
        content: f.content,
        score: f.score,
      }));
    } else {
      // ★ Vector only: DenseRetriever
      const denseTopK = dto.denseTopK ?? SEARCH_DEFAULTS.denseTopK;
      retrieveResults = await this.denseRetriever.retrieve({
        query: dto.query,
        queryVector: vector,
        kbId: dto.kbId,
        modelName: model,
        topK: denseTopK,
      });

      rerankInputs = retrieveResults.map((r) => ({
        chunkId: r.chunkId,
        content: r.content,
        score: r.score,
      }));
    }

    // 4. Reranker (optional)
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
    const finalResults: SearchResult[] = retrieveResults.slice(0, topK).map(
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
      totalCandidates: retrieveResults.length,
    };

    // 6. Populate cache (fire-and-forget)
    this.redis
      .set(cacheKey, JSON.stringify(response), RETRIEVAL_CACHE_TTL)
      .catch((err) => this.logger.warn('Failed to cache retrieval result', err));

    return response;
  }

  /**
   * Parent-Child Chunk Resolution (reserved for future use)
   *
   * When parent-child chunking is enabled:
   * 1. Retrieve child chunks (high precision vector match)
   * 2. Resolve parent_chunk_id → get parent chunks (full context)
   * 3. Deduplicate by parent ID → return parent content
   *
   * Gate: parentChildEnabled flag (default false).
   * Requires splitter to generate parent-child chunks first.
   */
  async resolveParentChunks(
    childResults: RetrieveResult[],
  ): Promise<RetrieveResult[]> {
    const childChunkIds = childResults.map((r) => r.chunkId);

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
      score: 0, // parent chunk has no vector score
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
   * Tries BGE first (local), falls back to Cohere if configured.
   * On any failure, returns empty array (caller should keep original results).
   */
  private async applyReranker(
    query: string,
    candidates: RetrieveResult[],
    topK: number,
  ): Promise<RetrieveResult[]> {
    // Try BGE first (local deployment, faster)
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
      const rerankMap = new Map(bgeResults.map((r) => [r.chunkId, r.relevanceScore]));
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
      const rerankMap = new Map(cohereResults.map((r) => [r.chunkId, r.relevanceScore]));
      return candidates
        .filter((c) => rerankMap.has(c.chunkId))
        .map((c) => ({ ...c, score: rerankMap.get(c.chunkId)! }))
        .sort((a, b) => b.score - a.score);
    }

    return [];
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/api/src/modules/retrieval/retrieval.service.ts
git commit -m "feat(retrieval): add RetrievalService pipeline orchestrator"
```

---

### Task 9: Retrieval Controller

**Files:**
- Create: `apps/api/src/modules/retrieval/retrieval.controller.ts`

- [ ] **Step 1: Write thin REST controller**

```typescript
import { Controller, Post, Body } from '@nestjs/common';
import { RetrievalService } from './retrieval.service';
import { SearchDto } from './dto/search.dto';

@Controller('retrieval')
export class RetrievalController {
  constructor(private readonly retrievalService: RetrievalService) {}

  @Post('search')
  search(@Body() dto: SearchDto) {
    return this.retrievalService.search(dto);
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/api/src/modules/retrieval/retrieval.controller.ts
git commit -m "feat(retrieval): add RetrievalController POST /retrieval/search"
```

---

### Task 10: Retrieval Module

**Files:**
- Create: `apps/api/src/modules/retrieval/retrieval.module.ts`

- [ ] **Step 1: Write NestJS module**

```typescript
import { Module } from '@nestjs/common';
import { RetrievalController } from './retrieval.controller';
import { RetrievalService } from './retrieval.service';
import { DenseRetriever } from './retrievers/dense-retriever';
import { SparseRetriever } from './retrievers/sparse-retriever';
import { RrfService } from './fusion/rrf.service';
import { BgeRerankerService } from './reranker/bge-reranker.service';
import { CohereRerankerService } from './reranker/cohere-reranker.service';
import { CitationService } from './citation/citation.service';

@Module({
  controllers: [RetrievalController],
  providers: [
    RetrievalService,
    DenseRetriever,
    SparseRetriever,
    RrfService,
    BgeRerankerService,
    CohereRerankerService,
    CitationService,
  ],
})
export class RetrievalModule {}
```

- [ ] **Step 2: Commit**

```bash
git add apps/api/src/modules/retrieval/retrieval.module.ts
git commit -m "feat(retrieval): add RetrievalModule"
```

---

### Task 11: Register in App Module

**Files:**
- Modify: `apps/api/src/modules/retrieval/app.module.ts` (wrong path — correct is `apps/api/src/app.module.ts`)

- [ ] **Step 1: Add RetrievalModule to imports**

In `apps/api/src/app.module.ts`, add the import line after the `UploadModule` import:

```typescript
import { RetrievalModule } from './modules/retrieval/retrieval.module';
```

And add `RetrievalModule` to the `imports` array after `UploadModule`:

```typescript
UploadModule,
RetrievalModule,
```

Context in the file:
```typescript
// After line 21:
import { UploadModule } from './modules/upload/upload.module';
// Add:
import { RetrievalModule } from './modules/retrieval/retrieval.module';

// In the @Module imports array, after line 45:
    UploadModule,
    // Add:
    RetrievalModule,
```

- [ ] **Step 2: Commit**

```bash
git add apps/api/src/app.module.ts
git commit -m "feat(retrieval): register RetrievalModule in AppModule"
```

---

### Task 12: Verification — Build Check

- [ ] **Step 1: TypeScript compilation check**

```bash
cd apps/api && npx tsc --noEmit 2>&1 | head -50
```
Expected: No errors (or only pre-existing errors unrelated to retrieval)

- [ ] **Step 2: Verify module loads**

```bash
cd apps/api && npx nest-start --dry-run 2>&1 || true
# Or just verify there are no import resolution issues
grep -r "RetrievalModule" apps/api/src/app.module.ts
```
Expected: Shows the import and module registration lines

---

## Self-Review Checklist

- [x] **Spec coverage:** Each design spec section maps to a task above (DTO→T1, retrievers→T4/T5, RRF→T3, reranker→T6, citation→T7, orchestrator→T8, controller→T9, module→T10, app registration→T11)
- [x] **No placeholders:** Every step has complete code, no TBD/TODO
- [x] **Type consistency:** `RetrieveResult` used consistently across DenseRetriever, SparseRetriever, RrfService, RetrievalService; `SearchDto`/`SearchResult`/`Citation` used in dto, controller, service; `RerankInput`/`RerankOutput` used in interface and both implementations
- [x] **No missing files:** All 12 files from CLAUDE.md section 2.2 accounted for
- [x] **Cache key consistency:** SHA256 hash format matches between `buildCacheKey()` and design spec
- [x] **Error handling:** Graceful degradation for sparse retriever failure and reranker failure implemented in RetrievalService
