# Retrieval Pipeline (Vector Search & Hybrid Search)

## 1. 模块概述（Overview）

Retrieval Pipeline 
(Query 侧核心链路 — 分层抽象: (Vector Search & Hybrid Search) → Rerank → Citation → Return)


## 2. 整体架构设计

### 2.0 分层设计理念

```
Retrieval Pipeline 不是单一 Retriever, 而是可组合的分层架构:

┌─────────────────────────────────────────────┐
│  Layer 1: Vector Search                     │
│  ├── DenseRetriever  (pgvector HNSW)        │
│  ├── SparseRetriever (BM25 tsvector)        │
│  └── RRF Fusion                             │
│      ↓                                      │
│  Layer 2: Rerank (精排, 可选)                │
│  ├── BGE-Reranker                           │
│  └── Cohere Rerank                          │
│      ↓                                      │
│  Layer 3: Citation (引用生成)                │
│      ↓                                      │
│  Layer 4: Return (结果返回)                  │
└─────────────────────────────────────────────┘

增加 Hybrid Search / 更换 Reranker:
不用修改任何上层代码, 只需替换 Layer 实现
```

### 2.1 双路召回 + RRF 融合架构

```
                       用户问题
                          │
                          ▼
┌──────────────────────────────────────────────────────────┐
│  1. Query Rewrite (可选)                                  │
│     "请假流程" → ["员工请假流程", "请假申请步骤"]              │
└──────────────────────────┬───────────────────────────────┘
                           │
              ┌────────────┴────────────┐
              ▼                         ▼
┌──────────────────────┐   ┌──────────────────────┐
│ 2a. DenseRetriever   │   │ 2b. SparseRetriever  │
│ (Vector / pgvector)  │   │ (BM25 / tsvector)    │
│ HNSW 索引            │    │ PostgreSQL 全文搜索    │
│ TopK=20 (语义相似)    │    │ TopK=20 (关键词匹配)   │
│ kb_ids 过滤 + RLS    │    │ kb_ids 过滤 + RLS     │
└──────────┬───────────┘   └──────────┬───────────┘
           │                          │
           └──────────┬───────────────┘
                      ▼
┌──────────────────────────────────────────────────────────┐
│  3. RRF (Reciprocal Rank Fusion) 融合                     │
│     score(d) = Σ 1/(k + rank_i(d))                       │
│     两路 Top20 → 融合排序 → Top20 (去重 + 重排)              │
└──────────────────────────┬───────────────────────────────┘
                           │
                           ▼
┌──────────────────────────────────────────────────────────┐
│  4. Reranker (精排)                                       │
│     BGE-Reranker / Cohere / cross-encoder                │
│     Top20 → Top5                                         │
│     仅在 retrieval_strategy='hybrid' 或 rerank.enabled    │
└──────────────────────────┬───────────────────────────────┘
                           │
                           ▼
┌──────────────────────────────────────────────────────────┐
│  5. Citation Generator                                   │
│     {document_name, page, version, snippet, score}       │
│     SSE Event: citations (在回答前优先吐出)                 │
└──────────────────────────┬───────────────────────────────┘
                           │
                           ▼
┌──────────────────────────────────────────────────────────┐
│  6. Prompt Template 渲染                                  │
│     {{context}} ← Top5 Chunks + Citations                │
│     {{question}} ← 用户问题                               │
│     {{history}} ← 对话历史                                │
└──────────────────────────┬───────────────────────────────┘
                           │
                           ▼
┌──────────────────────────────────────────────────────────┐
│  7. LLM (SSE Streaming)                                  │
│     SSE Events: step → citations → delta* → done         │
│     支持 AbortController 中途终止                          │
└──────────────────────────────────────────────────────────┘
```

### 2.2 模块拆分 (Retrieval Module)

```
retrieval/
├── retrieval.module.ts
├── retrieval.controller.ts
├── retrieval.service.ts          # 编排: 双路召回 → RRF → Reranker
│
├── retrievers/
│   ├── base-retriever.ts         # 抽象基类
│   ├── dense-retriever.ts        # Vector / pgvector HNSW
│   └── sparse-retriever.ts       # BM25 / PostgreSQL tsvector
│
├── fusion/
│   └── rrf.service.ts            # Reciprocal Rank Fusion
│
├── reranker/
│   ├── reranker.interface.ts
│   ├── bge-reranker.service.ts
│   └── cohere-reranker.service.ts
│
├── citation/
│   └── citation.service.ts
│
└── dto/
    └── search.dto.ts
```

### 2.3 配置项 (per Knowledge Base)

| 配置 | 默认值 | 说明 |
|------|--------|------|
| `retrieval.strategy` | `vector` | `vector`=纯向量, `hybrid`=BM25+Vector+RRF |
| `retrieval.denseTopK` | 20 | DenseRetriever 粗排数量 |
| `retrieval.sparseTopK` | 20 | SparseRetriever 粗排数量 |
| `retrieval.rrf_k` | 60 | RRF 融合参数 |
| `rerank.enabled` | false | 是否启用 Reranker (hybrid 模式默认开启) |
| `rerank.topK` | 5 | Reranker 精排后数量 |
| `rerank.model` | `bge-reranker-v2-m3` | Rerank 模型 |
| `query_rewrite.enabled` | false | 是否启用多 Query |
| `query_rewrite.count` | 3 | 生成 Query 数量 |

### 2.4 缓存分层架构

```
┌──────────────────────────────────────────────────────────┐
│                      Redis (BullMQ + Cache + Lock)       │
│                                                          │
│  ┌─ Layer 3: Retrieval 结果缓存 (可选) ────────────────┐   │
│  │  Key:    retrieval:{kb_id}:{sha256(query)}        │   │
│  │  Value:  chunk_ids[] + scores[]                   │   │
│  │  TTL:    5min (热数据短期有效)                      │   │
│  │  用途:   同 KB 内重复查询直接返回检索结果              │   │
│  └───────────────────────────────────────────────────┘   │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

### 2.5 Parent-Child Chunking 策略 (召回增强)

```
传统 RAG 困境:
  - 小 Chunk (256 token): 向量匹配精度高, 但上下文片段不完整, LLM 理解困难
  - 大 Chunk (1024 token): 上下文完整, 但语义被稀释, 向量匹配精度下降

解决方案: Parent-Child Chunking (双层分块)

  ┌─────────────────────────────────────────────────────┐
  │              Document (PDF / Word / ...)            │
  └────────────────────────┬────────────────────────────┘
                           │
                           ▼
  ┌─────────────────────────────────────────────────────┐
  │  1. Large Chunk (Parent) = 1024 tokens              │
  │     ├── Parent A: "员工手册第1章..."                  │
  │     ├── Parent B: "员工手册第2章..."                  │
  │     └── Parent C: "员工手册第3章..."                  │
  │                                                     │
  │  2. Small Chunk (Child) = 256 tokens                │
  │     ├── Child A1 (→ Parent A)                       │
  │     ├── Child A2 (→ Parent A)                       │
  │     ├── Child B1 (→ Parent B)                       │
  │     └── ...                                         │
  └─────────────────────────────────────────────────────┘
                           │
                           ▼
  ┌─────────────────────────────────────────────────────┐
  │  检索流程:                                           │
  │  1. 用户 Query → Embedding → 向量检索 (Child)         │
  │     → 命中 Child A1, Child B1 (小 Chunk 精确匹配)     │
  │                                                     │
  │  2. parent_chunk_id → 获取 Parent A, Parent B        │
  │     → 大 Chunk 作为 LLM 上下文 (完整语境)              │
  │                                                     │
  │  3. 去重后 Prompt: <Parent A 全文> <Parent B 全文>    │
  └─────────────────────────────────────────────────────┘

数据库支持:
  document_chunks.parent_chunk_id → document_chunks.id
  子 Chunk (parent_chunk_id IS NOT NULL)   → 用于向量检索
  父 Chunk (parent_chunk_id IS NULL)       → 作为 LLM 上下文
```

### 2.6 配置项 (per Knowledge Base) — 增加 Parent-Child

| 配置 | 默认值 | 说明 |
|------|--------|------|
| `chunk.parent_size` | 1024 | 父 Chunk 大小 (tokens) |
| `chunk.child_size` | 256 | 子 Chunk 大小 (tokens) |
| `chunk.parent_overlap` | 100 | 父 Chunk 重叠 |
| `chunk.child_overlap` | 50 | 子 Chunk 重叠 |
| `retrieval.childTopK` | 20 | 子 Chunk 粗排数量 |
| `retrieval.parentTopK` | 5 | 去重后父 Chunk 作为上下文的数量 |

## 关注点
1、现有的 chunk 设计未仅一层，未实现父子chunk,评估该功能实现繁琐程度，以及实现方案，需人工审核；
2、本地Vector Search 和 Hybrid Search 均实现。
