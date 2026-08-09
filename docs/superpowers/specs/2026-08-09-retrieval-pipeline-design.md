# Retrieval Pipeline — Design Spec

**Date:** 2026-08-09
**Source:** `apps/api/src/modules/retrieval/claude.md`
**Scope:** Retrieval-only module — returns `SearchResult[]`, consumed by chat/SSE layer

## Architecture

Layered, composable pipeline:

```
search(query, kbId, opts)
  ├─ 1. Query Embedding (EmbeddingService)
  ├─ 2. Parallel Retrieval
  │     ├─ DenseRetriever  → pgvector <=> (cosine distance, HNSW)
  │     └─ SparseRetriever → tsvector @@ + ts_rank (BM25)
  ├─ 3. RRF Fusion (if hybrid strategy)
  ├─ 4. Reranker (if enabled)
  └─ 5. CitationService.buildCitations()
```

Each layer has a single-responsibility interface, swappable without touching other layers.

## Module Structure (12 files)

```
retrieval/
├── retrieval.module.ts
├── retrieval.controller.ts
├── retrieval.service.ts
├── retrievers/
│   ├── base-retriever.ts
│   ├── dense-retriever.ts
│   └── sparse-retriever.ts
├── fusion/
│   └── rrf.service.ts
├── reranker/
│   ├── reranker.interface.ts
│   ├── bge-reranker.service.ts
│   └── cohere-reranker.service.ts
├── citation/
│   └── citation.service.ts
└── dto/
    └── search.dto.ts
```

## API

**Endpoint:** `POST /api/v1/retrieval/search`

**Request:**
```typescript
{
  query: string;                    // required
  kbId: string;                     // required
  strategy?: 'vector' | 'hybrid';   // override KB default
  topK?: number;                    // final count, default 5
  denseTopK?: number;               // default 20
  sparseTopK?: number;              // default 20
  rerank?: boolean;                 // default false
}
```

**Response:** `SearchResult[]` where each result has `chunkId`, `documentId`, `documentName`, `page`, `content`, `score`, and `citation` (documentName, page, version, snippet).

## Key Decisions

- **No separate repository layer** — matches existing codebase pattern (services call Prisma directly)
- **Raw SQL for vector/tsvector queries** — Prisma doesn't support `vector` or `tsvector` types
- **Retrieval-only scope** — returns data, doesn't call LLM
- **Redis cache** — key `retrieval:{kbId}:{sha256(query+opts)}`, TTL 5 min
- **Parent-child chunking deferred** — `retrieval_service` has `resolveParentChunks()` method gated by flag, ready when splitter is updated
- **Query rewrite deferred** — interface预留, default disabled
- **Per-KB config** — uses existing `knowledge_bases.retrieval_strategy` column; other params via request DTO with defaults from CLAUDE.md section 2.3

## Error Handling

| Scenario | Response |
|----------|----------|
| Empty query | 400 via validation |
| KB not found | 404 |
| No chunks in KB | `{ results: [] }` (not an error) |
| Embedding provider fails | 502 |
| pgvector timeout | 503 |
| tsvector unpopulated | Dense-only fallback |
| Reranker API fails | Graceful degradation (skip rerank) |
| Redis unavailable | Skip cache, compute directly |

## Testing

- **Unit:** RrfService, CitationService, each retriever with mocked Prisma
- **Integration:** RetrievalService.search() with real pgvector test DB

## Dependencies

- `PrismaService` (global)
- `EmbeddingService` (global)
- `RedisService` (global)
- `ModelProviderService` (global, for reranker config)
- All four are `@Global()` — no imports needed in RetrievalModule
