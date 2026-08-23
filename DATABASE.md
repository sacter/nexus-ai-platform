# NexusAI Platform — 数据库设计

---

## 1. 概述

- **数据库**: PostgreSQL 18+
- **向量扩展**: pgvector (0.7+)
- **ORM**: Prisma
- **字符集**: UTF-8

---

## 2. 启用扩展

```sql
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
```

---

## 3. 完整 ER 图

```
┌──────────────────────────┐
│     knowledge_bases      │
├──────────────────────────┤
│ id (PK)           │──┐   │     ┌──────────────────────┐
│ name              │  │   │     │  kb_permissions      │
│ description       │  │   │     ├──────────────────────┤
│ embedding_model   │  │   ├────►│ id (PK)              │
│ retrieval_strategy│  │   │     │ kb_id (FK)           │
│ created_by (FK) ──│──│───┘     │ user_id (FK)         │
│ is_active         │  │         │ role                 │
│ created_at        │  │         │ created_at           │
│ updated_at        │  │         └──────────────────────┘
└───────────────────┘  │
        │              │
        ▼              │
┌──────────────────┐   │
│    documents     │   │
├──────────────────┤   │
│ id (PK)          │   │
│ kb_id (FK) ──────│───┘
│ user_id (FK) ────│───► users
│current_version_id│◄──┐
│ name             │   │
│ original_name    │   │     ┌──────────────────────┐
│ url (MinIO)      │   │     │  document_versions   │
│ file_size        │   │     ├──────────────────────┤
│ mime_type        │   │     │ id (PK)              │
│ page_count       │   │     │ document_id (FK) ────│─── documents
│ status           │   │     │ version_number       │
│ chunk_count      │   │     │ file_url             │
│ embedding_model  │   │     │ page_count           │
│ embedding_dim    │   │     │ chunk_count          │
│ error_message    │   │     │ status               │
│ created_at       │   │     │ change_summary       │
│ updated_at       │   │     │ created_by (FK) ─────│───► users
└──────────────────┘   │     │ created_at           │
        │              │     └──────────────────────┘
        │              │               │
        ▼              │               │ (Chunk 只属于 Version)
┌──────────────────┐   │               │
│  document_chunks │   │               │
├──────────────────┤   │               │
│ id (PK)          │   │               │
│ version_id (FK)──│───┘               │ (不再有 document_id)
│ page             │                   │
│ chunk_index      │                   │
│ content          │     ┌──────────────────────┐
│ content_hash     │     │     index_jobs       │
│ token_count      │     ├──────────────────────┤
│ tsv              │     │ id (PK)              │
│ metadata (JSONB) │     │ document_id (FK) ────│─── documents
│ created_at       │     │ version_id (FK) ─────│─── document_versions
│ updated_at       │     │ job_type             │
└──────────────────┘     │ status               │
        │                │ progress (0-100)     │
        │                │ total_steps          │
┌───────┴──────────┐     │ current_step         │
│ chunk_embeddings │     │ step_description     │
├──────────────────┤     │ error_message        │
│ id (PK)          │     │ retry_count          │
│ chunk_id (FK)────│──┐  │ started_at           │
│ model_name       │  │  │ completed_at         │
│ embedding(vector)│  │  │ created_at           │
│ created_at       │  │  │ updated_at           │
└──────────────────┘  │  └──────────────────────┘
                      │
┌──────────────────┐  │  ┌──────────────────────┐
│     users        │  │  │       workflows      │
├──────────────────┤  │  ├──────────────────────┤
│ id (PK)          │  │  │ id (PK)              │
│ username         │  │  │ name                 │
│ email            │  │  │ type                 │
│ password_hash    │◄─┼──│ description          │
│ role             │  │  │ version              │
│ is_active        │  │  │ config (JSONB)       │
│ created_at       │  │  │ is_active            │
│ updated_at       │  │  │ created_by (FK) ─────│───► users
└──────────────────┘  │  │ created_at           │
        ▲             │  │ updated_at           │
        │             │  └──────────────────────┘
        │             │           │
┌───────┴──────────┐  │  ┌────────┴─────────────┐
│  ★ ai_applications│  │  │  ★ workflow_nodes   │
├──────────────────┤  │  ├──────────────────────┤
│ id (PK)          │  │  │ id (PK)              │
│ name             │  │  │ workflow_id (FK) ────│─── workflows
│ description      │  │  │ type                 │
│ kb_id (FK) ──────│──┘  │ label                │
│ workflow_id (FK)─│────►│ position_x           │
│ model_id (FK) ───│──┐  │ position_y           │
│ prompt_id (FK) ──│──┼──│ config (JSONB)       │
│ icon             │  │  │ created_at           │
│ status           │  │  │ updated_at           │
│ config (JSONB)   │  │  └──────────────────────┘
│ created_by (FK) ─│──│──► users               │
│ created_at       │  │  ┌──────────────────────┐
│ updated_at       │  │  │  ★ workflow_edges    │
└──────────────────┘  │  ├──────────────────────┤
        │             │  │ id (PK)              │
        │             │  │ workflow_id (FK) ────│─── workflows
┌───────┴──────────┐  │  │ source_node_id (FK)──│─── workflow_nodes
│★ ai_app_tools    │  │  │ target_node_id (FK)──│─── workflow_nodes
├──────────────────┤  │  │ source_handle        │
│ id (PK)          │  │  │ target_handle        │
│ application_id ──│──┘  │ label                │
│ tool_id ─────────│────►│ condition (JSONB)    │
│ config (JSONB)   │     │ created_at           │
└──────────────────┘     └──────────────────────┘
        │
        │                ┌──────────────────────┐
┌───────┴──────────┐     │★ workflow_executions │
│    ★ models      │     ├──────────────────────┤
├──────────────────┤     │ id (PK)              │
│ id (PK)          │     │ workflow_id (FK) ────│─── workflows
│ provider         │     │ application_id (FK)──│─── ai_applications
│ model_name       │     │ session_id (FK) ─────│─── chat_sessions
│ type             │     │ input (JSONB)        │
│ display_name     │     │ output (JSONB)       │
│ description      │     │ status               │
│ config (JSONB)   │     │ duration_ms          │
│ api_key_id (FK)──│──┐  │ error_message        │
│ is_active        │  │  │ node_steps (JSONB)   │
│ created_at       │  │  │ started_at           │
│ updated_at       │  │  │ completed_at         │
└──────────────────┘  │  │ created_at           │
                      │  └──────────────────────┘
┌──────────────────┐  │
│    ★ tools       │  │
├──────────────────┤  │
│ id (PK)          │  │
│ name             │  │
│ type             │  │
│ display_name     │  │
│ description      │  │
│ config (JSONB)   │  │
│ api_key_id (FK)──│──┘
│ is_active        │
│ created_by (FK) ─│──► users
│ created_at       │
│ updated_at       │
└──────────────────┘

┌──────────────────────┐
│     api_keys         │
├──────────────────────┤
│ id (PK)              │      ┌──────────────────────┐
│ provider             │      │  prompt_templates    │
│ name                 │      ├──────────────────────┤
│ model                │      │ id (PK)              │──┐
│ base_url             │      │ name                 │  │
│ api_key (加密)        │      │ description          │  │
│ is_active            │      │ current_version_id───│──┼─┐
│ created_by (FK) ─────│──► users                    │  │ │
│ created_at           │      │ created_at           │  │ │
│ updated_at           │      │ updated_at           │  │ │
└──────────────────────┘      └──────────────────────┘  │ │
                                                        │ │
┌──────────────────────┐      ┌────────────────────────┐ │ │
│  chat_sessions       │      │ prompt_template_ver    │◄┘ │
├──────────────────────┤      ├────────────────────────┤   │
│ id (PK)              │      │ id (PK)                │   │
│ user_id (FK) ────────│──► users                      │   │
│ kb_id (FK) ──────────│──► knowledge_bases            │   │
│ ai_application_id ───│──► ★ ai_applications (新增)    │   │
│ title                │      │ template_id (FK)       │───┘
│prompt_template_id(FK)│──┐   │ version_number         │
│ workflow_type        │  │   │ content                │
│ workflow_id (FK) ────│──┼──►│ variables (JSONB)      │
│ created_at           │  │   │ is_active              │
│ updated_at           │  │   │ created_by (FK) ───────│──► users
└──────────────────────┘  │   │ created_at             │
        │                 │   └────────────────────────┘
        ▼                 │
┌──────────────────┐      │   ┌──────────────────────┐
│  chat_messages   │      │   │   audit_logs         │
├──────────────────┤      │   ├──────────────────────┤
│ id (PK)          │      │   │ id (PK)              │
│ session_id (FK)──│──────┘   │ user_id (FK) ────────│──► users
│ role             │          │ action               │
│ content          │          │ entity_type          │
│ citations (JSONB)│          │ entity_id            │
│ metadata (JSONB) │          │ kb_id (FK) ──────────│──► knowledge_bases
│ created_at       │          │ details (JSONB)      │
└──────────────────┘          │ ip_address           │
                              │ created_at           │
┌──────────────────────┐      └──────────────────────┘
│  system_settings     │
├──────────────────────┤
│ id (单行)             │
│ config (JSONB)       │
│ updated_by (FK) ─────│──► users
│ updated_at           │
└──────────────────────┘

★ = 新增表 (V2/V3 逐步启用)
```

---

## 4. 建表 SQL

### 4.1 knowledge_bases — 知识库表

```sql
CREATE TABLE knowledge_bases (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name                VARCHAR(256) NOT NULL,
    description         TEXT                  DEFAULT NULL,
    created_by          UUID          NOT NULL REFERENCES users(id),

    -- ★ 每个 Knowledge Base 可独立配置 ★
    embedding_model     VARCHAR(64)            DEFAULT NULL,    -- 'openai/text-embedding-3-small', 'bge-m3'
    retrieval_strategy  VARCHAR(32)   NOT NULL DEFAULT 'vector'
                            CHECK (retrieval_strategy IN ('vector', 'hybrid')),

    is_active           BOOLEAN       NOT NULL DEFAULT TRUE,
    created_at          TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_kb_created_by ON knowledge_bases(created_by);

COMMENT ON TABLE knowledge_bases IS '知识库表 — 顶层 Namespace, 每 KB 可独立配 Embedding/Retrieval';
COMMENT ON COLUMN knowledge_bases.embedding_model IS '如 bge-m3, text-embedding-3-small。NULL=使用系统默认';
COMMENT ON COLUMN knowledge_bases.retrieval_strategy IS 'vector=纯向量检索, hybrid=BM25+Vector 混合检索';
```

### 4.2 kb_permissions — 知识库权限表

```sql
CREATE TYPE kb_role AS ENUM ('admin', 'editor', 'viewer');

CREATE TABLE kb_permissions (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    kb_id           UUID         NOT NULL REFERENCES knowledge_bases(id) ON DELETE CASCADE,
    user_id         UUID         NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role            kb_role      NOT NULL DEFAULT 'viewer',
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),

    UNIQUE (kb_id, user_id)
);

CREATE INDEX idx_kb_perm_kb_id   ON kb_permissions(kb_id);
CREATE INDEX idx_kb_perm_user_id ON kb_permissions(user_id);

COMMENT ON TABLE kb_permissions IS '知识库级别 RBAC';
COMMENT ON COLUMN kb_permissions.role IS 'admin=管理, editor=上传+编辑, viewer=只读';
```

### 4.3 users — 用户表

```sql
CREATE TABLE users (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    username        VARCHAR(64)  NOT NULL UNIQUE,
    email           VARCHAR(255) NOT NULL UNIQUE,
    password_hash   VARCHAR(255) NOT NULL,
    role            VARCHAR(32)  NOT NULL DEFAULT 'user'
                        CHECK (role IN ('admin', 'user')),
    is_active       BOOLEAN      NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE users IS '用户表';
COMMENT ON COLUMN users.role IS '系统级角色: admin | user';
```

### 4.4 documents — 文档表

```sql
CREATE TYPE document_status AS ENUM (
    'UPLOADING',
    'PROCESSING',
    'READY',
    'FAILED',
    'DELETED'
);

CREATE TABLE documents (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- 知识库关联 ★
    kb_id               UUID          NOT NULL REFERENCES knowledge_bases(id) ON DELETE CASCADE,
    -- 上传者
    user_id             UUID          REFERENCES users(id) ON DELETE SET NULL,
    -- 当前活跃版本 ★
    current_version_id  UUID                   DEFAULT NULL,

    -- 文件信息
    name                VARCHAR(512)  NOT NULL,
    original_name       VARCHAR(512)  NOT NULL,
    url                 VARCHAR(1024) NOT NULL,               -- MinIO object key
    file_size           BIGINT        NOT NULL DEFAULT 0,
    mime_type           VARCHAR(128)  NOT NULL DEFAULT 'application/pdf',
    page_count          INTEGER                DEFAULT 0,

    -- 状态
    status              document_status NOT NULL DEFAULT 'UPLOADING',

    -- 索引统计 (聚合当前版本)
    chunk_count         INTEGER        NOT NULL DEFAULT 0,
    embedding_model     VARCHAR(64)             DEFAULT NULL,
    embedding_dim       INTEGER                 DEFAULT NULL,

    -- 错误
    error_message       TEXT                    DEFAULT NULL,

    -- 时间戳
    created_at          TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ    NOT NULL DEFAULT NOW()
);

-- 索引
CREATE INDEX idx_documents_kb_id       ON documents(kb_id);
CREATE INDEX idx_documents_user_id     ON documents(user_id);
CREATE INDEX idx_documents_status      ON documents(status);
CREATE INDEX idx_documents_created_at  ON documents(created_at DESC);

COMMENT ON TABLE documents IS '文档表 — 关联知识库, 通过 current_version_id 指向当前活跃版本';
```

### 4.5 document_versions — 文档版本表

```sql
CREATE TYPE version_status AS ENUM ('PROCESSING', 'READY', 'FAILED');

CREATE TABLE document_versions (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    document_id     UUID           NOT NULL REFERENCES documents(id) ON DELETE CASCADE,

    version_number  INTEGER        NOT NULL DEFAULT 1,         -- v1, v2, v3...
    file_url        VARCHAR(1024)  NOT NULL,                   -- 该版本的 MinIO key
    page_count      INTEGER        NOT NULL DEFAULT 0,
    chunk_count     INTEGER        NOT NULL DEFAULT 0,
    status          version_status NOT NULL DEFAULT 'PROCESSING',
    change_summary  TEXT                    DEFAULT NULL,       -- 变更说明

    created_by      UUID           REFERENCES users(id),
    created_at      TIMESTAMPTZ    NOT NULL DEFAULT NOW(),

    UNIQUE (document_id, version_number)
);

CREATE INDEX idx_versions_document_id ON document_versions(document_id);

COMMENT ON TABLE document_versions IS '文档版本表 — 同一文档 v1/v2/v3, 不覆盖';
COMMENT ON COLUMN document_versions.change_summary IS '版本变更说明, 如 "更新了考勤规则章节"';
```

### 4.6 document_chunks — Chunk 表

```sql
CREATE TABLE document_chunks (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- ★ 只关联 Version, 不再直接关联 Document
    version_id      UUID          NOT NULL REFERENCES document_versions(id) ON DELETE CASCADE,

    -- Chunk 定位
    page            INTEGER       NOT NULL DEFAULT 1,
    chunk_index     INTEGER       NOT NULL DEFAULT 0,

    -- ★ Parent-Child Chunking (小 Chunk 检索 + 大 Chunk 上下文)
    parent_chunk_id UUID                   DEFAULT NULL REFERENCES document_chunks(id) ON DELETE SET NULL,

    -- 内容
    content         TEXT          NOT NULL,
    content_hash    VARCHAR(64)            DEFAULT NULL,  -- SHA-256
    token_count     INTEGER       NOT NULL DEFAULT 0,

    -- 全文搜索 (Hybrid Search 数据源)
    tsv             TSVECTOR               DEFAULT NULL,  -- ★ SparseRetriever BM25

    -- 元数据
    metadata        JSONB                  DEFAULT '{}',

    -- 时间戳
    created_at      TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ    NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_chunks_version_id   ON document_chunks(version_id);
CREATE INDEX idx_chunks_page_index   ON document_chunks(version_id, page, chunk_index);
CREATE INDEX idx_chunks_content_hash ON document_chunks(content_hash);
CREATE INDEX idx_chunks_parent       ON document_chunks(parent_chunk_id);  -- ★ Parent-Child 查询

-- GIN 索引 (全文搜索)
CREATE INDEX idx_chunks_tsv ON document_chunks USING gin(tsv);

-- 自动更新 tsv (触发器)
CREATE TRIGGER trg_chunks_tsv
    BEFORE INSERT OR UPDATE ON document_chunks
    FOR EACH ROW EXECUTE FUNCTION
    tsvector_update_trigger(tsv, 'pg_catalog.simple', content);

COMMENT ON TABLE document_chunks IS 'Chunk 表 — 仅关联 version_id。向量移至 chunk_embeddings, tsv 用于 Hybrid Search, parent_chunk_id 支持父子分块';
COMMENT ON COLUMN document_chunks.parent_chunk_id IS '★ Parent-Child Chunking: 子 Chunk(小,用于向量检索) → 父 Chunk(大,作为 LLM 上下文)';
```

### 4.6b chunk_embeddings — 向量独立表 (优化: 冗余 kb_id 加速过滤)

```sql
CREATE TABLE chunk_embeddings (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    chunk_id        UUID         NOT NULL REFERENCES document_chunks(id) ON DELETE CASCADE,
    model_name      VARCHAR(64)  NOT NULL,                        -- 'text-embedding-3-small', 'bge-m3'
    embedding       vector(3072) NOT NULL,                        -- 最大维度兼容, 插入时按实际维度填充

    -- ★ 冗余 kb_id: 加速带 KB 元数据过滤的向量检索, 避免跨表 JOIN 后再过滤
    kb_id           UUID         NOT NULL REFERENCES knowledge_bases(id) ON DELETE CASCADE,

    created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),

    UNIQUE (chunk_id, model_name)                                 -- 一个 Chunk 一个模型一条向量
);

-- HNSW 索引
CREATE INDEX idx_chunk_embeddings_vector ON chunk_embeddings
    USING hnsw (embedding vector_cosine_ops)
    WITH (m = 16, ef_construction = 200);

CREATE INDEX idx_chunk_embeddings_chunk_id ON chunk_embeddings(chunk_id);
CREATE INDEX idx_chunk_embeddings_model   ON chunk_embeddings(model_name);
CREATE INDEX idx_chunk_embeddings_kb_id   ON chunk_embeddings(kb_id);       -- ★ 加速 KB 过滤

COMMENT ON TABLE chunk_embeddings IS '向量独立表 — 多 Embedding 模型并存, 冗余 kb_id 加速 KB 级向量检索过滤';
COMMENT ON COLUMN chunk_embeddings.kb_id IS '★ 冗余字段: 避免向量检索后跨 document_chunks→documents JOIN 回表过滤 KB, 减少全表 HNSW 扫描';
```

### 4.7 index_jobs — 索引任务表

```sql
CREATE TYPE job_status AS ENUM ('PENDING', 'RUNNING', 'DONE', 'FAILED');
CREATE TYPE job_type   AS ENUM ('INDEX', 'REINDEX', 'DELETE_CHUNKS');

CREATE TABLE index_jobs (
    id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    document_id      UUID          NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    version_id       UUID                   DEFAULT NULL REFERENCES document_versions(id) ON DELETE SET NULL, -- ★

    job_type         job_type      NOT NULL DEFAULT 'INDEX',
    status           job_status    NOT NULL DEFAULT 'PENDING',

    -- 进度
    progress         SMALLINT      NOT NULL DEFAULT 0
                        CHECK (progress BETWEEN 0 AND 100),
    total_steps      INTEGER       NOT NULL DEFAULT 0,
    current_step     INTEGER       NOT NULL DEFAULT 0,
    step_description TEXT                   DEFAULT NULL,

    -- 错误 & 重试 ★
    error_message    TEXT                   DEFAULT NULL,
    retry_count      INTEGER       NOT NULL DEFAULT 0,

    -- 时间
    started_at       TIMESTAMPTZ            DEFAULT NULL,
    completed_at     TIMESTAMPTZ            DEFAULT NULL,
    created_at       TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    updated_at       TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_jobs_document_id ON index_jobs(document_id);
CREATE INDEX idx_jobs_version_id  ON index_jobs(version_id);
CREATE INDEX idx_jobs_status      ON index_jobs(status);
CREATE INDEX idx_jobs_created_at  ON index_jobs(created_at DESC);

-- ★ 防重: 同一文档同一类型同时只能有一个活跃 Job
CREATE UNIQUE INDEX idx_unique_active_job
    ON index_jobs (document_id, job_type)
    WHERE status IN ('PENDING', 'RUNNING');

COMMENT ON TABLE index_jobs IS '索引任务 — 追踪 Index Pipeline 每一步, 支持重试, 活跃 Job 唯一约束防重';
COMMENT ON COLUMN index_jobs.retry_count IS '已重试次数, Worker 可根据此值决定是否最终失败';
```

### 4.8 chat_sessions — 对话会话表 (增强: ai_application_id)

```sql
CREATE TABLE chat_sessions (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id             UUID         NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    kb_id               UUID                  DEFAULT NULL REFERENCES knowledge_bases(id) ON DELETE SET NULL,
    title               VARCHAR(512) NOT NULL DEFAULT 'New Chat',
    prompt_template_id  UUID                  DEFAULT NULL,

    -- ★ AI Application 关联 (V2)
    ai_application_id   UUID                  DEFAULT NULL,     -- 若通过 AI App 发起, 记录来源
    model_id            UUID                  DEFAULT NULL,     -- 会话自带对话模型（快捷/自定义模式写入，使会话自包含）

    -- ★ Workflow 关联
    workflow_type       VARCHAR(32)  NOT NULL DEFAULT 'rag'
                            CHECK (workflow_type IN ('rag', 'reflection', 'rewoo', 'multi_agent')),
    workflow_id         UUID                  DEFAULT NULL,

    created_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_chat_sessions_user_id        ON chat_sessions(user_id);
CREATE INDEX idx_chat_sessions_kb_id          ON chat_sessions(kb_id);
CREATE INDEX idx_chat_sessions_ai_app_id      ON chat_sessions(ai_application_id);  -- ★

COMMENT ON TABLE chat_sessions IS 'RAG 对话会话 — 可关联 AI Application, 自动加载绑定配置';
COMMENT ON COLUMN chat_sessions.ai_application_id IS 'V2 新增: 指向 ai_applications, NULL=手动选择 KB+Workflow';
```

### 4.9 chat_messages — 对话消息表

```sql
CREATE TYPE message_role AS ENUM ('user', 'assistant', 'system');

CREATE TABLE chat_messages (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id      UUID         NOT NULL REFERENCES chat_sessions(id) ON DELETE CASCADE,

    role            message_role NOT NULL,
    content         TEXT         NOT NULL,

    -- 引用 (Citation) ★
    citations       JSONB                 DEFAULT '[]',        -- [{chunk_id, document_name, page, content_snippet, score}]

    -- ★ Token 统计 (精准成本核算 + Context Window 管理)
    prompt_tokens     INTEGER      NOT NULL DEFAULT 0,         -- 输入 Token 数
    completion_tokens INTEGER      NOT NULL DEFAULT 0,         -- 输出 Token 数
    total_tokens      INTEGER      NOT NULL DEFAULT 0,         -- 总 Token 数

    -- 元数据
    metadata        JSONB                 DEFAULT '{}',        -- {latency_ms, model, execution_id, truncated, ...}

    created_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_chat_messages_session_id ON chat_messages(session_id);
CREATE INDEX idx_chat_messages_created_at ON chat_messages(session_id, created_at);

COMMENT ON TABLE chat_messages IS '对话消息 — citations 字段存储引用文档/Chunk 信息, Token 字段支撑成本核算';
COMMENT ON COLUMN chat_messages.citations IS 'JSONB 数组: [{chunk_id, document_name, page, snippet, score}]';
COMMENT ON COLUMN chat_messages.prompt_tokens IS '★ 输入 Token 数, 用于成本核算';
COMMENT ON COLUMN chat_messages.completion_tokens IS '★ 输出 Token 数, 用于成本核算';
COMMENT ON COLUMN chat_messages.total_tokens IS '★ 总 Token 数 = prompt_tokens + completion_tokens';
COMMENT ON COLUMN chat_messages.metadata IS '含 execution_id 可关联 workflow_executions 追溯完整链路, truncated=true 表示已被 Context Window 裁剪';
```

### 4.10 prompt_templates — Prompt 模板表

```sql
CREATE TABLE prompt_templates (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name                VARCHAR(256) NOT NULL UNIQUE,
    description         TEXT                  DEFAULT NULL,
    current_version_id  UUID                  DEFAULT NULL,    -- 指向 prompt_template_versions.id
    created_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE prompt_templates IS 'Prompt 模板 — 支持多版本, 后台可调';

-- Prompt 模板版本
CREATE TABLE prompt_template_versions (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    template_id     UUID         NOT NULL REFERENCES prompt_templates(id) ON DELETE CASCADE,
    version_number  INTEGER      NOT NULL DEFAULT 1,
    content         TEXT         NOT NULL,                     -- 模板正文, 如 "You are... Context: {{context}} Question: {{question}}"
    variables       JSONB                 DEFAULT '[]',       -- ["context", "question", "history"]
    is_active       BOOLEAN      NOT NULL DEFAULT TRUE,
    created_by      UUID         REFERENCES users(id),
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),

    UNIQUE (template_id, version_number)
);

CREATE INDEX idx_pt_versions_template_id ON prompt_template_versions(template_id);

COMMENT ON TABLE prompt_template_versions IS 'Prompt 模板版本 — 变即打版本, 不影响历史会话';
```

### 4.11 audit_logs — 审计日志表

```sql
CREATE TYPE audit_action AS ENUM (
    'DOCUMENT_UPLOAD',
    'DOCUMENT_DELETE',
    'DOCUMENT_REINDEX',
    'KB_CREATE',
    'KB_DELETE',
    'KB_UPDATE',
    'PERMISSION_CHANGE',
    'SETTING_CHANGE',
    'API_KEY_CREATE',
    'API_KEY_DELETE',
    'PROMPT_CREATE',
    'PROMPT_UPDATE',
    'USER_LOGIN',
    'VERSION_ACTIVATE',
    -- ★ V2 新增
    'AI_APP_CREATE',
    'AI_APP_DELETE',
    'AI_APP_UPDATE',
    'MODEL_REGISTER',
    'MODEL_DELETE',
    'WORKFLOW_CREATE',
    'WORKFLOW_UPDATE',
    'WORKFLOW_EXECUTE',
    -- ★ V3 新增
    'TOOL_REGISTER',
    'TOOL_DELETE',
    'TOOL_EXECUTE',
    'CHAT_FEEDBACK'
);

CREATE TABLE audit_logs (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id         UUID                  DEFAULT NULL REFERENCES users(id) ON DELETE SET NULL,
    action          audit_action NOT NULL,
    entity_type     VARCHAR(64)  NOT NULL,                     -- 'document', 'knowledge_base', 'ai_application', 'model', 'tool', ...
    entity_id       UUID                  DEFAULT NULL,
    kb_id           UUID                  DEFAULT NULL REFERENCES knowledge_bases(id) ON DELETE SET NULL,
    details         JSONB                 DEFAULT '{}',        -- 变更详情
    ip_address      VARCHAR(45)           DEFAULT NULL,
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_audit_user_id    ON audit_logs(user_id);
CREATE INDEX idx_audit_kb_id      ON audit_logs(kb_id);
CREATE INDEX idx_audit_action     ON audit_logs(action);
CREATE INDEX idx_audit_created_at ON audit_logs(created_at DESC);

COMMENT ON TABLE audit_logs IS '审计日志 — 记录所有关键操作。生产环境建议: 移除物理外键→逻辑关联 + 按月表分区, 避免 Write-Heavy 拖慢主库';
COMMENT ON COLUMN audit_logs.details IS 'JSONB: {old_value, new_value, affected_rows, ...}';
```

> **生产优化建议 — audit_logs 高频写入策略:**
>
> 审计日志是典型的 Write-Heavy 单向追加表, 高并发场景下可能拖慢主库。
>
> ```
> 策略 1 (推荐): 移除物理外键 → 仅逻辑关联
>   - user_id, kb_id 不加 REFERENCES 约束
>   - 异步清理孤儿记录 (定时 GC)
>   - 写入性能提升 30-50%
>
> 策略 2 (大规模): PostgreSQL 表分区 (按月)
>   CREATE TABLE audit_logs (...) PARTITION BY RANGE (created_at);
>   CREATE TABLE audit_logs_2026_07 PARTITION OF audit_logs
>       FOR VALUES FROM ('2026-07-01') TO ('2026-08-01');
>   - 按时间范围查询自动裁剪分区
>   - 过期数据直接 DROP PARTITION
> ```

### 4.12 api_keys — API Key 表

```sql
CREATE TABLE api_keys (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    provider        VARCHAR(64)  NOT NULL,                     -- 'openai', 'dashscope', 'deepseek', 'bge', 'cohere', 'anthropic'
    name            VARCHAR(256) NOT NULL,                     -- 便于识别的名称
    model           VARCHAR(128) NOT NULL DEFAULT '',          -- 默认模型
    base_url        VARCHAR(512)          DEFAULT NULL,        -- 自定义 API 端点 (如代理)
    api_key         VARCHAR(512) NOT NULL,                     -- 加密存储
    is_active       BOOLEAN      NOT NULL DEFAULT TRUE,
    created_by      UUID         NOT NULL REFERENCES users(id),
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),

    UNIQUE (provider, name)
);

CREATE INDEX idx_api_keys_provider ON api_keys(provider);

COMMENT ON TABLE api_keys IS 'API Key — 仅管理凭证。Model 注册移至 models 表, 通过 models.api_key_id 引用';
COMMENT ON COLUMN api_keys.provider IS 'Provider 标识: openai, dashscope, deepseek, anthropic, cohere, bge...';
```

### 4.13 system_settings — 系统设置表

```sql
-- 使用单行 JSONB 存储全部配置, 而非散落的 key-value
CREATE TABLE system_settings (
    id              SMALLINT PRIMARY KEY DEFAULT 1 CHECK (id = 1),  -- 永远只有一行
    config          JSONB        NOT NULL DEFAULT '{}',
    updated_by      UUID         REFERENCES users(id),
    updated_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- 初始化默认配置
INSERT INTO system_settings (id, config) VALUES (1, '{
  "embedding": {
    "provider": "openai",
    "model": "text-embedding-ada-002",
    "dimension": 1536
  },
  "chunk": {
    "size": 1000,
    "overlap": 200
  },
  "retrieval": {
    "topK": 20,
    "similarityThreshold": 0.7,
    "strategy": "vector"
  },
  "rerank": {
    "enabled": false,
    "topN": 20,
    "rerankTopK": 5,
    "model": "bge-reranker-v2-m3"
  },
  "queryRewrite": {
    "enabled": false,
    "count": 3
  },
  "system": {
    "maxFileSize": 52428800,
    "allowedTypes": ["application/pdf", "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"]
  }
}'::jsonb);

COMMENT ON TABLE system_settings IS '全局系统配置 — 单行 JSONB, 强结构化, 字段有明确 Schema';
```

### 4.14 workflows — Workflow 配置表

```sql
CREATE TYPE workflow_type_enum AS ENUM ('rag', 'reflection', 'rewoo', 'multi_agent');

CREATE TABLE workflows (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name            VARCHAR(256) NOT NULL,
    type            workflow_type_enum NOT NULL,
    description     TEXT                  DEFAULT NULL,
    version         INTEGER       NOT NULL DEFAULT 1,
    config          JSONB         NOT NULL DEFAULT '{}',         -- Workflow 特定配置
    is_active       BOOLEAN       NOT NULL DEFAULT TRUE,
    created_by      UUID          NOT NULL REFERENCES users(id),
    created_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_workflows_type ON workflows(type);

-- 初始化默认 Workflow
INSERT INTO workflows (name, type, version, config, created_by) VALUES
('Default RAG', 'rag', 1,
 '{"retriever": {"topK": 20}, "rerank": {"enabled": false}, "prompt_template": "default_rag"}',
 (SELECT id FROM users WHERE role = 'admin' LIMIT 1));

COMMENT ON TABLE workflows IS 'Workflow 配置表 — 后台可选择不同 Workflow 类型, 配置可版本化';
COMMENT ON COLUMN workflows.config IS 'JSONB: 各 Workflow 类型的特定配置。rag={retriever,rerank,prompt}, reflection={maxIterations,judgePrompt}, rewoo={planner,solver}, multi_agent={agents[]}';
```

### 4.15 workflow_nodes — Workflow 节点表 (★ V2 新增)

```sql
CREATE TYPE workflow_node_type AS ENUM (
    'start',        -- 开始节点
    'end',          -- 结束节点
    'retriever',    -- 检索节点 (调用 Knowledge Base)
    'llm',          -- LLM 调用节点
    'tool',         -- 工具调用节点
    'condition',    -- 条件分支节点
    'reflection',   -- 反思/自省节点
    'planner',      -- 规划节点 (ReWOO)
    'solver',       -- 求解节点 (ReWOO)
    'aggregator',   -- 聚合节点 (Multi-Agent)
    'code'          -- 代码执行节点
);

CREATE TABLE workflow_nodes (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workflow_id     UUID               NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,

    -- 节点类型与标识
    type            workflow_node_type NOT NULL,
    label           VARCHAR(128)       NOT NULL,                  -- UI 显示名称, 如 "检索知识库"
    description     TEXT                        DEFAULT NULL,    -- 节点说明

    -- ★ 可视化布局 (为 V3 Workflow Designer 预留)
    position_x      DOUBLE PRECISION   NOT NULL DEFAULT 0,
    position_y      DOUBLE PRECISION   NOT NULL DEFAULT 0,

    -- 节点配置 (按 type 不同)
    config          JSONB              NOT NULL DEFAULT '{}',
    -- retriever: {kb_ids: [...], topK: 20, strategy: "hybrid"}
    -- llm:       {model_id: "...", prompt_template_id: "...", temperature: 0.7}
    -- tool:      {tool_id: "...", timeout: 10000}
    -- condition: {expression: "...", branches: ["yes", "no"]}
    -- reflection:{max_iterations: 3, judge_prompt_id: "..."}

    created_at      TIMESTAMPTZ        NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ        NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_wf_nodes_workflow_id ON workflow_nodes(workflow_id);

COMMENT ON TABLE workflow_nodes IS 'Workflow 节点表 — 图中的一个节点, 定义类型/位置/配置';
COMMENT ON COLUMN workflow_nodes.position_x IS 'V3 Designer: 画布 X 坐标 (像素)';
COMMENT ON COLUMN workflow_nodes.position_y IS 'V3 Designer: 画布 Y 坐标 (像素)';
COMMENT ON COLUMN workflow_nodes.config IS 'JSONB: 节点类型特定配置, 如 retriever 的 kb_ids+topK';
```

### 4.16 workflow_edges — Workflow 边表 (★ V2 新增)

```sql
CREATE TABLE workflow_edges (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workflow_id     UUID               NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,

    -- 源节点 & 目标节点
    source_node_id  UUID               NOT NULL REFERENCES workflow_nodes(id) ON DELETE CASCADE,
    target_node_id  UUID               NOT NULL REFERENCES workflow_nodes(id) ON DELETE CASCADE,

    -- 连接点标识 (为 V3 Designer 预留)
    source_handle   VARCHAR(64)        DEFAULT NULL,              -- 源连接点, 如 "output", "yes", "no"
    target_handle   VARCHAR(64)        DEFAULT NULL,              -- 目标连接点, 如 "input"

    -- 边信息
    label           VARCHAR(128)       DEFAULT NULL,              -- 边标签, 如 "条件成立"
    condition       JSONB              DEFAULT NULL,              -- 条件表达式 (用于 condition 节点的分支)
    -- 例: {"field": "judge_result", "operator": "equals", "value": "needs_improvement"}

    created_at      TIMESTAMPTZ        NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_wf_edges_workflow_id ON workflow_edges(workflow_id);
CREATE INDEX idx_wf_edges_source      ON workflow_edges(source_node_id);
CREATE INDEX idx_wf_edges_target      ON workflow_edges(target_node_id);

COMMENT ON TABLE workflow_edges IS 'Workflow 边表 — 图中节点间的连线, 可带条件';
COMMENT ON COLUMN workflow_edges.condition IS 'JSONB: 条件分支表达式, 满足时才走这条边';
COMMENT ON COLUMN workflow_edges.source_handle IS '源节点输出端口名, 如 "output" / "yes" / "no"';
```

### 4.17 workflow_executions — Workflow 执行记录表 (★ V2 新增)

```sql
CREATE TYPE execution_status AS ENUM ('RUNNING', 'COMPLETED', 'FAILED', 'CANCELLED', 'PAUSED', 'WAITING');

CREATE TABLE workflow_executions (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workflow_id     UUID               NOT NULL REFERENCES workflows(id) ON DELETE SET NULL,
    application_id  UUID                        DEFAULT NULL REFERENCES ai_applications(id) ON DELETE SET NULL,
    session_id      UUID                        DEFAULT NULL REFERENCES chat_sessions(id) ON DELETE SET NULL,

    -- ★ 输入 / 输出
    input           JSONB              NOT NULL DEFAULT '{}',
    -- {question: "请假流程是什么?", kb_ids: [...], chat_history: [...], model_id: "...", ...}

    output          JSONB                       DEFAULT NULL,
    -- {answer: "...", citations: [...], tool_results: [...], ...}

    -- 执行状态
    status          execution_status   NOT NULL DEFAULT 'RUNNING',
    duration_ms     INTEGER                     DEFAULT NULL,    -- 执行耗时 (毫秒)
    error_message   TEXT                        DEFAULT NULL,

    -- ★ 逐节点执行步骤 (核心调试/审计数据)
    node_steps      JSONB                       DEFAULT '[]',
    -- [
    --   {"node_id": "...", "node_type": "retriever", "status": "completed",
    --    "input": {...}, "output": {...}, "duration_ms": 350,
    --    "started_at": "...", "completed_at": "..."},
    --   ...
    -- ]

    -- 时间
    started_at      TIMESTAMPTZ                 DEFAULT NULL,
    completed_at    TIMESTAMPTZ                 DEFAULT NULL,
    created_at      TIMESTAMPTZ        NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_wf_exec_workflow_id    ON workflow_executions(workflow_id);
CREATE INDEX idx_wf_exec_application_id ON workflow_executions(application_id);
CREATE INDEX idx_wf_exec_session_id     ON workflow_executions(session_id);
CREATE INDEX idx_wf_exec_status         ON workflow_executions(status);
CREATE INDEX idx_wf_exec_created_at     ON workflow_executions(created_at DESC);

COMMENT ON TABLE workflow_executions IS 'Workflow 执行记录 — 每次 Agent 执行的完整追踪, 支持暂停/恢复 (Human-in-the-loop)';
COMMENT ON COLUMN workflow_executions.status IS 'RUNNING=执行中, COMPLETED=成功, FAILED=失败, CANCELLED=取消, PAUSED=暂停(可恢复), WAITING=等待外部输入(如人工审批)';
COMMENT ON COLUMN workflow_executions.node_steps IS 'JSONB 数组: 每个 Node 的执行输入/输出/耗时/状态, 断点上下文用于长流程恢复执行';
COMMENT ON COLUMN workflow_executions.session_id IS '关联 Chat Session, 可追溯到具体对话';
COMMENT ON COLUMN workflow_executions.application_id IS '关联 AI Application, 记录使用哪个应用';
```

### 4.18 ai_applications — AI 应用表 (★ V2 核心新增)

```sql
CREATE TYPE application_status AS ENUM ('active', 'inactive', 'draft');

CREATE TABLE ai_applications (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- 基本信息
    name            VARCHAR(256)       NOT NULL,
    description     TEXT                        DEFAULT NULL,
    icon            VARCHAR(64)                 DEFAULT 'bot',      -- 图标标识 (前端渲染)

    -- ★ 资源绑定: AI Application = KB + Workflow + Model + Prompt + Tools
    knowledge_base_id UUID              NOT NULL REFERENCES knowledge_bases(id) ON DELETE RESTRICT,
    workflow_id     UUID               NOT NULL REFERENCES workflows(id) ON DELETE RESTRICT,
    model_id        UUID               NOT NULL REFERENCES models(id) ON DELETE RESTRICT,
    prompt_template_id UUID                     DEFAULT NULL REFERENCES prompt_templates(id) ON DELETE SET NULL,

    -- 状态
    status          application_status NOT NULL DEFAULT 'draft',

    -- 扩展配置
    config          JSONB              NOT NULL DEFAULT '{}',
    -- {
    --   "temperature": 0.7,
    --   "maxTokens": 4096,
    --   "welcomeMessage": "你好! 我是财务助手, 可以解答...",
    --   "suggestedQuestions": ["请假流程是什么?", "报销需要什么材料?"]
    -- }

    -- 审计
    created_by      UUID               NOT NULL REFERENCES users(id),
    created_at      TIMESTAMPTZ        NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ        NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_ai_apps_kb_id      ON ai_applications(knowledge_base_id);
CREATE INDEX idx_ai_apps_workflow_id ON ai_applications(workflow_id);
CREATE INDEX idx_ai_apps_model_id    ON ai_applications(model_id);
CREATE INDEX idx_ai_apps_status      ON ai_applications(status);
CREATE INDEX idx_ai_apps_created_by  ON ai_applications(created_by);

COMMENT ON TABLE ai_applications IS 'AI 应用表 — 企业 AI 产品的载体。绑定 KB + Workflow + Model + Prompt, 面向最终用户';
COMMENT ON COLUMN ai_applications.knowledge_base_id IS '绑定知识库, 对话时自动使用该 KB 检索';
COMMENT ON COLUMN ai_applications.workflow_id IS '绑定 Workflow, 决定 Agent 执行策略 (rag/reflection/rewoo/...)';
COMMENT ON COLUMN ai_applications.model_id IS '绑定 Model, 决定对话使用哪个 LLM';
COMMENT ON COLUMN ai_applications.prompt_template_id IS '绑定 Prompt, 决定对话的 System Prompt';
```

### 4.19 ai_application_tools — AI 应用-工具关联表 (★ V3 新增)

```sql
CREATE TABLE ai_application_tools (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    application_id  UUID               NOT NULL REFERENCES ai_applications(id) ON DELETE CASCADE,
    tool_id         UUID               NOT NULL REFERENCES tools(id) ON DELETE CASCADE,

    -- 工具在应用中的特定配置 (覆盖工具默认配置)
    config          JSONB              DEFAULT '{}',

    created_at      TIMESTAMPTZ        NOT NULL DEFAULT NOW(),

    UNIQUE (application_id, tool_id)
);

CREATE INDEX idx_ai_app_tools_app_id  ON ai_application_tools(application_id);
CREATE INDEX idx_ai_app_tools_tool_id ON ai_application_tools(tool_id);

COMMENT ON TABLE ai_application_tools IS 'AI 应用与工具的 N:M 关联 — 一个应用可挂载多个工具';
```

### 4.19b chat_session_tools — 会话工具绑定表 (★ V3 新增)

```sql
CREATE TABLE chat_session_tools (
    id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id UUID NOT NULL REFERENCES chat_sessions(id) ON DELETE CASCADE,
    tool_id    UUID NOT NULL REFERENCES tools(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (session_id, tool_id)
);

CREATE INDEX idx_chat_session_tools_session_id ON chat_session_tools(session_id);
CREATE INDEX idx_chat_session_tools_tool_id    ON chat_session_tools(tool_id);

COMMENT ON TABLE chat_session_tools IS '会话与工具的 N:M 绑定 — 快捷模式从 AI 应用快照写入，自定义模式手动选择写入';
```

```prisma
model ChatSessionTool {
  id        String   @id @default(uuid()) @db.Uuid
  sessionId String   @map("session_id") @db.Uuid
  toolId    String   @map("tool_id") @db.Uuid
  createdAt DateTime @default(now()) @map("created_at") @db.Timestamptz()
  session   ChatSession @relation(fields: [sessionId], references: [id], onDelete: Cascade)
  tool      Tool        @relation(fields: [toolId], references: [id], onDelete: Cascade)
  @@unique([sessionId, toolId])
  @@index([sessionId])
  @@index([toolId])
  @@map("chat_session_tools")
}
```

### 4.20 models — 模型注册表 (★ V2 核心新增)

```sql
CREATE TYPE model_type AS ENUM ('chat', 'embedding', 'rerank');

CREATE TABLE models (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- Provider + Model
    provider        VARCHAR(64)        NOT NULL,                    -- 'openai', 'deepseek', 'qwen', 'anthropic', 'bge', 'cohere'
    model_name      VARCHAR(128)       NOT NULL,                    -- 'gpt-4o', 'deepseek-chat', 'qwen-turbo'
    type            model_type         NOT NULL,                    -- chat | embedding | rerank

    -- 显示信息
    display_name    VARCHAR(256)       NOT NULL,                    -- 前端显示名称: "GPT-4o"
    description     TEXT                        DEFAULT NULL,       -- 模型描述

    -- ★ 关联凭证: 通过 api_key_id 引用 api_keys 表, 获取实际密钥
    api_key_id      UUID                        DEFAULT NULL REFERENCES api_keys(id) ON DELETE SET NULL,

    -- 模型配置
    config          JSONB              NOT NULL DEFAULT '{}',
    -- chat:       {maxTokens: 4096, temperature: 0.7, supportsVision: false, supportsTools: true}
    -- embedding:  {dimension: 1536, maxBatchSize: 2048}
    -- rerank:     {maxBatchSize: 100}

    -- 状态
    is_active       BOOLEAN            NOT NULL DEFAULT TRUE,

    created_at      TIMESTAMPTZ        NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ        NOT NULL DEFAULT NOW(),

    UNIQUE (provider, model_name)
);

CREATE INDEX idx_models_provider ON models(provider);
CREATE INDEX idx_models_type     ON models(type);
CREATE INDEX idx_models_api_key  ON models(api_key_id);

COMMENT ON TABLE models IS '模型注册中心 — 统一管理平台所有可用模型, 与 api_keys 凭证解耦';
COMMENT ON COLUMN models.type IS 'chat=对话模型, embedding=嵌入模型, rerank=重排序模型';
COMMENT ON COLUMN models.api_key_id IS 'FK → api_keys, 引用该 Provider 的 API 凭证。NULL=使用环境变量默认';
COMMENT ON COLUMN models.config IS 'JSONB: 模型能力参数, 按 type 不同结构不同';
COMMENT ON COLUMN models.provider IS 'Provider 标识, 与 api_keys.provider 对应';

-- ★ Model vs API Key 的关系说明:
-- api_keys:     凭证层 — 存储 Provider 的 API 密钥 (sk-xxx...), 加密存储
-- models:       注册层 — 描述 Provider 下有哪些可用模型及其能力参数
-- 关系:         models.api_key_id → api_keys.id
-- 示例:
--   api_keys:  {provider: "openai", api_key: "sk-abc123..."}
--   models:    {provider: "openai", model: "gpt-4o",             type: "chat",      api_key_id → api_keys.id}
--   models:    {provider: "openai", model: "text-embedding-3-s", type: "embedding", api_key_id → api_keys.id}
-- 一个 api_key 可被多个 model 引用 (同一 Provider 下的不同模型)
```

### 4.21 tools — 工具注册表 (★ V3 新增)

```sql
CREATE TYPE tool_type AS ENUM ('sql', 'http', 'search', 'function', 'filesystem');

CREATE TABLE tools (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- 工具标识
    name            VARCHAR(128)       NOT NULL UNIQUE,             -- 唯一标识: 'postgres_query', 'weather_api', 'web_search'
    type            tool_type          NOT NULL,
    display_name    VARCHAR(256)       NOT NULL,                    -- 前端显示: "SQL 查询", "天气 API"
    description     TEXT                        DEFAULT NULL,       -- 工具描述 (给 LLM 看的)

    -- ★ 关联凭证 (如 HTTP 工具需要 API Key)
    api_key_id      UUID                        DEFAULT NULL REFERENCES api_keys(id) ON DELETE SET NULL,

    -- 工具配置 (按 type 不同)
    config          JSONB              NOT NULL DEFAULT '{}',
    -- sql:        {connection: "postgresql://...", maxRows: 100, timeout: 5000}
    -- http:       {url: "https://api.weather.com/v1", method: "POST", headers: {...}, timeout: 10000}
    -- search:     {engine: "tavily", maxResults: 10}
    -- function:   {code: "...", runtime: "javascript"}
    -- filesystem: {basePath: "/data", allowedOperations: ["read"]}

    -- 安全配置
    security        JSONB              NOT NULL DEFAULT '{}',
    -- {allowedDomains: ["api.weather.com"], maxInputSize: 4096, maxOutputSize: 65536, rateLimit: 100}

    is_active       BOOLEAN            NOT NULL DEFAULT TRUE,
    created_by      UUID               NOT NULL REFERENCES users(id),
    created_at      TIMESTAMPTZ        NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ        NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_tools_type      ON tools(type);
CREATE INDEX idx_tools_api_key   ON tools(api_key_id);
CREATE INDEX idx_tools_is_active ON tools(is_active);

COMMENT ON TABLE tools IS '工具注册中心 — 注册 Agent 可调用的工具, 供 Workflow/Agent 使用';
COMMENT ON COLUMN tools.type IS 'sql=数据库查询, http=HTTP请求, search=Web搜索, function=内置函数, filesystem=文件系统';
COMMENT ON COLUMN tools.config IS 'JSONB: 各类型工具特定配置, 如连接串/URL/代码等';
COMMENT ON COLUMN tools.security IS 'JSONB: 安全限制, 白名单域名/输入输出大小/速率限制';
COMMENT ON COLUMN tools.description IS '给 LLM 看的 Function Description, 用于 Agent Tool Calling';
```

---

## 5. Prisma Schema (完整版)

```prisma
// prisma/schema.prisma

generator client {
  provider        = "prisma-client-js"
  previewFeatures = ["pgvector"]
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

// ── Enums ──

enum DocumentStatus    { UPLOADING PROCESSING READY FAILED DELETED }
enum VersionStatus     { PROCESSING READY FAILED }
enum JobStatus         { PENDING RUNNING DONE FAILED }
enum JobType           { INDEX REINDEX DELETE_CHUNKS }
enum KbRole            { admin editor viewer }
enum MessageRole       { user assistant system }
enum AuditAction       {
  DOCUMENT_UPLOAD DOCUMENT_DELETE DOCUMENT_REINDEX
  KB_CREATE KB_DELETE KB_UPDATE
  PERMISSION_CHANGE SETTING_CHANGE
  API_KEY_CREATE API_KEY_DELETE
  PROMPT_CREATE PROMPT_UPDATE
  USER_LOGIN VERSION_ACTIVATE
  // ★ V2
  AI_APP_CREATE AI_APP_DELETE AI_APP_UPDATE
  MODEL_REGISTER MODEL_DELETE
  WORKFLOW_CREATE WORKFLOW_UPDATE WORKFLOW_EXECUTE
  // ★ V3
  TOOL_REGISTER TOOL_DELETE TOOL_EXECUTE
  CHAT_FEEDBACK
}

// ★ 新增 Enum
enum ModelType          { chat embedding rerank }
enum ToolType           { sql http search function filesystem }
enum ApplicationStatus  { active inactive draft }
enum ExecutionStatus    { RUNNING COMPLETED FAILED CANCELLED PAUSED WAITING }
enum WorkflowNodeType   {
  start end retriever llm tool condition
  reflection planner solver aggregator code
}

// ── Models (原有, 未改动部分省略注释) ──

model User {
  id           String   @id @default(uuid()) @db.Uuid
  username     String   @unique @db.VarChar(64)
  email        String   @unique @db.VarChar(255)
  passwordHash String   @map("password_hash") @db.VarChar(255)
  role         String   @default("user") @db.VarChar(32)
  isActive     Boolean  @default(true) @map("is_active")
  createdAt    DateTime @default(now()) @map("created_at") @db.Timestamptz()
  updatedAt    DateTime @updatedAt @map("updated_at") @db.Timestamptz()

  knowledgeBases    KnowledgeBase[]
  kbPermissions     KbPermission[]
  documents         Document[]
  chatSessions      ChatSession[]
  apiKeys           ApiKey[]
  auditLogs         AuditLog[]
  promptVersions    PromptTemplateVersion[]
  documentVersions  DocumentVersion[]
  aiApplications    AiApplication[]     // ★
  models            Model[]             // ★
  tools             Tool[]              // ★
  workflows         Workflow[]          // ★

  @@map("users")
}

model KnowledgeBase {
  id                String   @id @default(uuid()) @db.Uuid
  name              String   @db.VarChar(256)
  description       String?
  embeddingModel    String?  @map("embedding_model") @db.VarChar(64)
  retrievalStrategy String   @default("vector") @map("retrieval_strategy") @db.VarChar(32)
  createdBy         String   @map("created_by") @db.Uuid
  isActive          Boolean  @default(true) @map("is_active")
  createdAt         DateTime @default(now()) @map("created_at") @db.Timestamptz()
  updatedAt         DateTime @updatedAt @map("updated_at") @db.Timestamptz()

  createdByUser  User           @relation(fields: [createdBy], references: [id])
  permissions    KbPermission[]
  documents      Document[]
  chatSessions   ChatSession[]
  auditLogs      AuditLog[]
  aiApplications AiApplication[]  // ★

  @@index([createdBy])
  @@map("knowledge_bases")
}

model KbPermission {
  id        String    @id @default(uuid()) @db.Uuid
  kbId      String    @map("kb_id") @db.Uuid
  userId    String    @map("user_id") @db.Uuid
  role      KbRole    @default(viewer)
  createdAt DateTime  @default(now()) @map("created_at") @db.Timestamptz()

  kb   KnowledgeBase @relation(fields: [kbId], references: [id], onDelete: Cascade)
  user User          @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([kbId, userId])
  @@index([kbId])
  @@index([userId])
  @@map("kb_permissions")
}

model Document {
  id               String         @id @default(uuid()) @db.Uuid
  kbId             String         @map("kb_id") @db.Uuid
  userId           String?        @map("user_id") @db.Uuid
  currentVersionId String?        @map("current_version_id") @db.Uuid
  name             String         @db.VarChar(512)
  originalName     String         @map("original_name") @db.VarChar(512)
  url              String         @db.VarChar(1024)
  fileSize         BigInt         @default(0) @map("file_size")
  mimeType         String         @default("application/pdf") @map("mime_type") @db.VarChar(128)
  pageCount        Int?           @map("page_count")
  status           DocumentStatus @default(UPLOADING)
  chunkCount       Int            @default(0) @map("chunk_count")
  embeddingModel   String?        @map("embedding_model") @db.VarChar(64)
  embeddingDim     Int?           @map("embedding_dim")
  errorMessage     String?        @map("error_message") @db.Text
  createdAt        DateTime       @default(now()) @map("created_at") @db.Timestamptz()
  updatedAt        DateTime       @updatedAt @map("updated_at") @db.Timestamptz()

  kb            KnowledgeBase     @relation(fields: [kbId], references: [id], onDelete: Cascade)
  user          User?             @relation(fields: [userId], references: [id], onDelete: SetNull)
  currentVersion DocumentVersion? @relation("CurrentVersion", fields: [currentVersionId], references: [id])
  versions      DocumentVersion[] @relation("DocumentVersions")
  jobs          IndexJob[]

  @@index([kbId])
  @@index([userId])
  @@index([status])
  @@index([createdAt(sort: Desc)])
  @@map("documents")
}

model DocumentVersion {
  id            String        @id @default(uuid()) @db.Uuid
  documentId    String        @map("document_id") @db.Uuid
  versionNumber Int           @default(1) @map("version_number")
  fileUrl       String        @map("file_url") @db.VarChar(1024)
  pageCount     Int           @default(0) @map("page_count")
  chunkCount    Int           @default(0) @map("chunk_count")
  status        VersionStatus @default(PROCESSING)
  changeSummary String?       @map("change_summary") @db.Text
  createdBy     String?       @map("created_by") @db.Uuid
  createdAt     DateTime      @default(now()) @map("created_at") @db.Timestamptz()

  document       Document         @relation("DocumentVersions", fields: [documentId], references: [id], onDelete: Cascade)
  createdByUser  User?            @relation(fields: [createdBy], references: [id])
  currentForDoc  Document?        @relation("CurrentVersion")
  chunks         DocumentChunk[]
  jobs           IndexJob[]

  @@unique([documentId, versionNumber])
  @@index([documentId])
  @@map("document_versions")
}

model DocumentChunk {
  id             String   @id @default(uuid()) @db.Uuid
  versionId      String   @map("version_id") @db.Uuid
  page           Int      @default(1)
  chunkIndex     Int      @default(0) @map("chunk_index")
  parentChunkId  String?  @map("parent_chunk_id") @db.Uuid     // ★ Parent-Child Chunking
  content        String   @db.Text
  contentHash    String?  @map("content_hash") @db.VarChar(64)
  tokenCount     Int      @default(0) @map("token_count")
  tsv            Unsupported("tsvector")?
  metadata       Json     @default("{}") @db.JsonB
  createdAt      DateTime @default(now()) @map("created_at") @db.Timestamptz()
  updatedAt      DateTime @updatedAt @map("updated_at") @db.Timestamptz()

  version        DocumentVersion   @relation(fields: [versionId], references: [id], onDelete: Cascade)
  parentChunk    DocumentChunk?    @relation("ParentChild", fields: [parentChunkId], references: [id], onDelete: SetNull)
  childChunks    DocumentChunk[]   @relation("ParentChild")
  embeddings     ChunkEmbedding[]

  @@index([versionId])
  @@index([versionId, page, chunkIndex])
  @@index([contentHash])
  @@map("document_chunks")
}

model ChunkEmbedding {
  id        String   @id @default(uuid()) @db.Uuid
  chunkId   String   @map("chunk_id") @db.Uuid
  modelName String   @map("model_name") @db.VarChar(64)
  kbId      String   @map("kb_id") @db.Uuid                   // ★ 冗余 kb_id 加速过滤
  embedding Unsupported("vector(3072)")
  createdAt DateTime @default(now()) @map("created_at") @db.Timestamptz()

  chunk DocumentChunk   @relation(fields: [chunkId], references: [id], onDelete: Cascade)
  kb    KnowledgeBase   @relation(fields: [kbId], references: [id], onDelete: Cascade)

  @@unique([chunkId, modelName])
  @@index([chunkId])
  @@index([modelName])
  @@index([kbId])                                             // ★
  @@map("chunk_embeddings")
}

model IndexJob {
  id              String    @id @default(uuid()) @db.Uuid
  documentId      String    @map("document_id") @db.Uuid
  versionId       String?   @map("version_id") @db.Uuid
  jobType         JobType   @default(INDEX) @map("job_type")
  status          JobStatus @default(PENDING)
  progress        Int       @default(0) @db.SmallInt
  totalSteps      Int       @default(0) @map("total_steps")
  currentStep     Int       @default(0) @map("current_step")
  stepDescription String?   @map("step_description") @db.Text
  errorMessage    String?   @map("error_message") @db.Text
  retryCount      Int       @default(0) @map("retry_count")
  startedAt       DateTime? @map("started_at") @db.Timestamptz()
  completedAt     DateTime? @map("completed_at") @db.Timestamptz()
  createdAt       DateTime  @default(now()) @map("created_at") @db.Timestamptz()
  updatedAt       DateTime  @updatedAt @map("updated_at") @db.Timestamptz()

  document Document         @relation(fields: [documentId], references: [id], onDelete: Cascade)
  version  DocumentVersion? @relation(fields: [versionId], references: [id], onDelete: SetNull)

  @@index([documentId])
  @@index([versionId])
  @@index([status])
  @@index([createdAt(sort: Desc)])
  @@map("index_jobs")
}

model ChatSession {
  id                String   @id @default(uuid()) @db.Uuid
  userId            String   @map("user_id") @db.Uuid
  kbId              String?  @map("kb_id") @db.Uuid
  title             String   @default("New Chat") @db.VarChar(512)
  promptTemplateId  String?  @map("prompt_template_id") @db.Uuid
  aiApplicationId   String?  @map("ai_application_id") @db.Uuid      // ★ V2
  modelId           String?  @map("model_id") @db.Uuid                          // ★ V3: 会话自带模型
  workflowType      String   @default("rag") @map("workflow_type") @db.VarChar(32)
  workflowId        String?  @map("workflow_id") @db.Uuid
  createdAt         DateTime @default(now()) @map("created_at") @db.Timestamptz()
  updatedAt         DateTime @updatedAt @map("updated_at") @db.Timestamptz()

  user           User              @relation(fields: [userId], references: [id], onDelete: Cascade)
  kb             KnowledgeBase?    @relation(fields: [kbId], references: [id], onDelete: SetNull)
  aiApplication  AiApplication?    @relation(fields: [aiApplicationId], references: [id])  // ★
  workflow       Workflow?         @relation(fields: [workflowId], references: [id])
  messages       ChatMessage[]
  executions     WorkflowExecution[]  // ★

  @@index([userId])
  @@index([kbId])
  @@index([aiApplicationId])  // ★
  @@map("chat_sessions")
}

model ChatMessage {
  id               String      @id @default(uuid()) @db.Uuid
  sessionId        String      @map("session_id") @db.Uuid
  role             MessageRole
  content          String      @db.Text
  citations        Json        @default("[]") @db.JsonB
  promptTokens     Int         @default(0) @map("prompt_tokens")      // ★
  completionTokens Int         @default(0) @map("completion_tokens")  // ★
  totalTokens      Int         @default(0) @map("total_tokens")       // ★
  metadata         Json        @default("{}") @db.JsonB
  createdAt        DateTime    @default(now()) @map("created_at") @db.Timestamptz()

  session ChatSession @relation(fields: [sessionId], references: [id], onDelete: Cascade)

  @@index([sessionId])
  @@index([sessionId, createdAt])
  @@map("chat_messages")
}

model PromptTemplate {
  id               String   @id @default(uuid()) @db.Uuid
  name             String   @unique @db.VarChar(256)
  description      String?
  currentVersionId String?  @map("current_version_id") @db.Uuid
  createdAt        DateTime @default(now()) @map("created_at") @db.Timestamptz()
  updatedAt        DateTime @updatedAt @map("updated_at") @db.Timestamptz()

  versions         PromptTemplateVersion[]
  aiApplications   AiApplication[]           // ★

  @@map("prompt_templates")
}

model PromptTemplateVersion {
  id            String   @id @default(uuid()) @db.Uuid
  templateId    String   @map("template_id") @db.Uuid
  versionNumber Int      @default(1) @map("version_number")
  content       String   @db.Text
  variables     Json     @default("[]") @db.JsonB
  isActive      Boolean  @default(true) @map("is_active")
  createdBy     String?  @map("created_by") @db.Uuid
  createdAt     DateTime @default(now()) @map("created_at") @db.Timestamptz()

  template      PromptTemplate @relation(fields: [templateId], references: [id], onDelete: Cascade)
  createdByUser User?          @relation(fields: [createdBy], references: [id])

  @@unique([templateId, versionNumber])
  @@index([templateId])
  @@map("prompt_template_versions")
}

model AuditLog {
  id         String      @id @default(uuid()) @db.Uuid
  userId     String?     @map("user_id") @db.Uuid
  action     AuditAction
  entityType String      @map("entity_type") @db.VarChar(64)
  entityId   String?     @map("entity_id") @db.Uuid
  kbId       String?     @map("kb_id") @db.Uuid
  details    Json        @default("{}") @db.JsonB
  ipAddress  String?     @map("ip_address") @db.VarChar(45)
  createdAt  DateTime    @default(now()) @map("created_at") @db.Timestamptz()

  user User?          @relation(fields: [userId], references: [id], onDelete: SetNull)
  kb   KnowledgeBase? @relation(fields: [kbId], references: [id], onDelete: SetNull)

  @@index([userId])
  @@index([kbId])
  @@index([action])
  @@index([createdAt(sort: Desc)])
  @@map("audit_logs")
}

model ApiKey {
  id        String   @id @default(uuid()) @db.Uuid
  provider  String   @db.VarChar(64)
  name      String   @db.VarChar(256)
  model     String   @default("") @db.VarChar(128)
  baseUrl   String?  @map("base_url") @db.VarChar(512)
  apiKey    String   @map("api_key") @db.VarChar(512)
  isActive  Boolean  @default(true) @map("is_active")
  createdBy String   @map("created_by") @db.Uuid
  createdAt DateTime @default(now()) @map("created_at") @db.Timestamptz()
  updatedAt DateTime @updatedAt @map("updated_at") @db.Timestamptz()

  createdByUser User     @relation(fields: [createdBy], references: [id])
  models        Model[]  // ★ 一个 api_key 可被多个 model 引用
  tools         Tool[]   // ★

  @@unique([provider, name])
  @@index([provider])
  @@map("api_keys")
}

model SystemSetting {
  id        Int       @id @default(1)
  config    Json      @default("{}") @db.JsonB
  updatedBy String?   @map("updated_by") @db.Uuid
  updatedAt DateTime  @updatedAt @map("updated_at") @db.Timestamptz()

  updatedByUser User? @relation(fields: [updatedBy], references: [id])

  @@map("system_settings")
}

model Workflow {
  id          String   @id @default(uuid()) @db.Uuid
  name        String   @db.VarChar(256)
  type        String   @db.VarChar(32)
  description String?
  version     Int      @default(1)
  config      Json     @default("{}") @db.JsonB
  isActive    Boolean  @default(true) @map("is_active")
  createdBy   String?  @map("created_by") @db.Uuid
  createdAt   DateTime @default(now()) @map("created_at") @db.Timestamptz()
  updatedAt   DateTime @updatedAt @map("updated_at") @db.Timestamptz()

  createdByUser User?               @relation(fields: [createdBy], references: [id])
  chatSessions  ChatSession[]
  nodes         WorkflowNode[]      // ★
  edges         WorkflowEdge[]      // ★
  executions    WorkflowExecution[] // ★
  aiApplications AiApplication[]    // ★

  @@index([type])
  @@map("workflows")
}

// ── ★★★ 新增 Models (V2/V3) ★★★ ──

// ★ V2: AI Application
model AiApplication {
  id               String            @id @default(uuid()) @db.Uuid
  name             String            @db.VarChar(256)
  description      String?
  icon             String            @default("bot") @db.VarChar(64)
  knowledgeBaseId  String            @map("knowledge_base_id") @db.Uuid
  workflowId       String            @map("workflow_id") @db.Uuid
  modelId          String            @map("model_id") @db.Uuid
  promptTemplateId String?           @map("prompt_template_id") @db.Uuid
  status           ApplicationStatus @default(draft)
  config           Json              @default("{}") @db.JsonB
  createdBy        String            @map("created_by") @db.Uuid
  createdAt        DateTime          @default(now()) @map("created_at") @db.Timestamptz()
  updatedAt        DateTime          @updatedAt @map("updated_at") @db.Timestamptz()

  kb              KnowledgeBase           @relation(fields: [knowledgeBaseId], references: [id], onDelete: Restrict)
  workflow        Workflow               @relation(fields: [workflowId], references: [id], onDelete: Restrict)
  model           Model                  @relation(fields: [modelId], references: [id], onDelete: Restrict)
  promptTemplate  PromptTemplate?        @relation(fields: [promptTemplateId], references: [id], onDelete: SetNull)
  createdByUser   User                   @relation(fields: [createdBy], references: [id])
  tools           AiApplicationTool[]    // ★ N:M → tools
  chatSessions    ChatSession[]
  executions      WorkflowExecution[]

  @@index([knowledgeBaseId])
  @@index([workflowId])
  @@index([modelId])
  @@index([status])
  @@index([createdBy])
  @@map("ai_applications")
}

// ★ V3: AI Application ↔ Tool (N:M junction)
model AiApplicationTool {
  id             String   @id @default(uuid()) @db.Uuid
  applicationId  String   @map("application_id") @db.Uuid
  toolId         String   @map("tool_id") @db.Uuid
  config         Json     @default("{}") @db.JsonB
  createdAt      DateTime @default(now()) @map("created_at") @db.Timestamptz()

  application AiApplication @relation(fields: [applicationId], references: [id], onDelete: Cascade)
  tool        Tool          @relation(fields: [toolId], references: [id], onDelete: Cascade)

  @@unique([applicationId, toolId])
  @@index([applicationId])
  @@index([toolId])
  @@map("ai_application_tools")
}

// ★ V2: Model Center
model Model {
  id          String    @id @default(uuid()) @db.Uuid
  provider    String    @db.VarChar(64)
  modelName   String    @map("model_name") @db.VarChar(128)
  type        ModelType
  displayName String    @map("display_name") @db.VarChar(256)
  description String?
  apiKeyId    String?   @map("api_key_id") @db.Uuid
  config      Json      @default("{}") @db.JsonB
  isActive    Boolean   @default(true) @map("is_active")
  createdAt   DateTime  @default(now()) @map("created_at") @db.Timestamptz()
  updatedAt   DateTime  @updatedAt @map("updated_at") @db.Timestamptz()

  apiKey         ApiKey?          @relation(fields: [apiKeyId], references: [id], onDelete: SetNull)
  aiApplications AiApplication[]

  @@unique([provider, modelName])
  @@index([provider])
  @@index([type])
  @@index([apiKeyId])
  @@map("models")
}

// ★ V2: Workflow Nodes
model WorkflowNode {
  id          String           @id @default(uuid()) @db.Uuid
  workflowId  String           @map("workflow_id") @db.Uuid
  type        WorkflowNodeType
  label       String           @db.VarChar(128)
  description String?
  positionX   Float            @default(0) @map("position_x")
  positionY   Float            @default(0) @map("position_y")
  config      Json             @default("{}") @db.JsonB
  createdAt   DateTime         @default(now()) @map("created_at") @db.Timestamptz()
  updatedAt   DateTime         @updatedAt @map("updated_at") @db.Timestamptz()

  workflow       Workflow         @relation(fields: [workflowId], references: [id], onDelete: Cascade)
  sourceEdges    WorkflowEdge[]   @relation("SourceNode")
  targetEdges    WorkflowEdge[]   @relation("TargetNode")

  @@index([workflowId])
  @@map("workflow_nodes")
}

// ★ V2: Workflow Edges
model WorkflowEdge {
  id            String   @id @default(uuid()) @db.Uuid
  workflowId    String   @map("workflow_id") @db.Uuid
  sourceNodeId  String   @map("source_node_id") @db.Uuid
  targetNodeId  String   @map("target_node_id") @db.Uuid
  sourceHandle  String?  @map("source_handle") @db.VarChar(64)
  targetHandle  String?  @map("target_handle") @db.VarChar(64)
  label         String?  @db.VarChar(128)
  condition     Json?
  createdAt     DateTime @default(now()) @map("created_at") @db.Timestamptz()

  workflow     Workflow     @relation(fields: [workflowId], references: [id], onDelete: Cascade)
  sourceNode   WorkflowNode @relation("SourceNode", fields: [sourceNodeId], references: [id], onDelete: Cascade)
  targetNode   WorkflowNode @relation("TargetNode", fields: [targetNodeId], references: [id], onDelete: Cascade)

  @@index([workflowId])
  @@index([sourceNodeId])
  @@index([targetNodeId])
  @@map("workflow_edges")
}

// ★ V2: Workflow Execution
model WorkflowExecution {
  id             String          @id @default(uuid()) @db.Uuid
  workflowId     String?         @map("workflow_id") @db.Uuid
  applicationId  String?         @map("application_id") @db.Uuid
  sessionId      String?         @map("session_id") @db.Uuid
  input          Json            @default("{}") @db.JsonB
  output         Json?
  status         ExecutionStatus @default(RUNNING)
  durationMs     Int?            @map("duration_ms")
  errorMessage   String?         @map("error_message") @db.Text
  nodeSteps      Json            @default("[]") @db.JsonB  @map("node_steps")
  startedAt      DateTime?       @map("started_at") @db.Timestamptz()
  completedAt    DateTime?       @map("completed_at") @db.Timestamptz()
  createdAt      DateTime        @default(now()) @map("created_at") @db.Timestamptz()

  workflow     Workflow?        @relation(fields: [workflowId], references: [id], onDelete: SetNull)
  application  AiApplication?   @relation(fields: [applicationId], references: [id], onDelete: SetNull)
  session      ChatSession?     @relation(fields: [sessionId], references: [id], onDelete: SetNull)

  @@index([workflowId])
  @@index([applicationId])
  @@index([sessionId])
  @@index([status])
  @@index([createdAt(sort: Desc)])
  @@map("workflow_executions")
}

// ★ V3: Tool Center
model Tool {
  id          String   @id @default(uuid()) @db.Uuid
  name        String   @unique @db.VarChar(128)
  type        ToolType
  displayName String   @map("display_name") @db.VarChar(256)
  description String?
  apiKeyId    String?  @map("api_key_id") @db.Uuid
  config      Json     @default("{}") @db.JsonB
  security    Json     @default("{}") @db.JsonB
  isActive    Boolean  @default(true) @map("is_active")
  createdBy   String   @map("created_by") @db.Uuid
  createdAt   DateTime @default(now()) @map("created_at") @db.Timestamptz()
  updatedAt   DateTime @updatedAt @map("updated_at") @db.Timestamptz()

  apiKey        ApiKey?              @relation(fields: [apiKeyId], references: [id], onDelete: SetNull)
  createdByUser User                 @relation(fields: [createdBy], references: [id])
  applications  AiApplicationTool[]

  @@index([type])
  @@index([apiKeyId])
  @@index([isActive])
  @@map("tools")
}
```

---

## 6. 关键查询示例

### 6.1 知识库列表 + 文档统计

```sql
SELECT
    kb.id, kb.name, kb.description,
    COUNT(d.id) FILTER (WHERE d.status != 'DELETED') AS doc_count,
    SUM(d.chunk_count) FILTER (WHERE d.status = 'READY') AS total_chunks
FROM knowledge_bases kb
LEFT JOIN documents d ON d.kb_id = kb.id
WHERE kb.is_active = TRUE
GROUP BY kb.id
ORDER BY kb.created_at DESC;
```

### 6.2 指定知识库 + 指定版本的向量检索 (优化: 利用 kb_id 冗余, 避免回表 JOIN)

```sql
-- ★ 优化后: 直接从 chunk_embeddings 按 kb_id 过滤, 无需跨 document_chunks→documents 回表
SELECT
    dc.id, dc.page, dc.chunk_index,
    dc.content, dc.metadata,
    ce.kb_id,
    1 - (ce.embedding <=> $1::vector) AS similarity
FROM chunk_embeddings ce
JOIN document_chunks dc    ON dc.id = ce.chunk_id
WHERE ce.kb_id = $2                      -- ★ 直接按 kb_id 过滤, 避免回表
  AND ce.model_name = $3                 -- 指定模型
ORDER BY ce.embedding <=> $1::vector
LIMIT $4;
```

### 6.2b Parent-Child Chunking 检索 (★ 新增)

```sql
-- Step 1: 向量检索命中小 Chunk (子 Chunk, 用于精确匹配)
-- Step 2: 通过 parent_chunk_id 获取大 Chunk (父 Chunk, 作为 LLM 上下文)

-- Step 1: 检索小 Chunk (不包含content, 只需 id + 相似度)
SELECT
    dc.id AS child_chunk_id,
    dc.parent_chunk_id,
    1 - (ce.embedding <=> $1::vector) AS similarity
FROM chunk_embeddings ce
JOIN document_chunks dc ON dc.id = ce.chunk_id
WHERE ce.kb_id = $2
  AND ce.model_name = $3
  AND dc.parent_chunk_id IS NOT NULL       -- ★ 只取子 Chunk
ORDER BY ce.embedding <=> $1::vector
LIMIT $4;

-- Step 2: 根据 parent_chunk_id 批量获取父 Chunk 完整内容 (去重)
SELECT
    dc.id, dc.content, dc.page, dc.chunk_index,
    d.name AS document_name, dv.version_number
FROM document_chunks dc
JOIN document_versions dv ON dv.id = dc.version_id
JOIN documents d          ON d.id = dv.document_id
WHERE dc.id = ANY($5::uuid[]);            -- $5 = 去重后的 parent_chunk_id 列表
```

### 6.2c Token 消耗统计 (★ 新增 — 成本核算)

```sql
-- 按用户统计某时间段的 Token 消耗
SELECT
    u.username,
    SUM(cm.prompt_tokens)     AS total_prompt_tokens,
    SUM(cm.completion_tokens) AS total_completion_tokens,
    SUM(cm.total_tokens)      AS total_tokens,
    COUNT(cm.id)              AS message_count
FROM chat_messages cm
JOIN chat_sessions cs ON cs.id = cm.session_id
JOIN users u          ON u.id = cs.user_id
WHERE cm.created_at BETWEEN $1 AND $2
  AND cm.role = 'assistant'              -- 只统计 AI 回复
GROUP BY u.username
ORDER BY total_tokens DESC;

-- 按 AI 应用统计 Token 消耗
SELECT
    app.name AS application_name,
    SUM(cm.total_tokens) AS total_tokens,
    COUNT(DISTINCT cs.id) AS session_count
FROM chat_messages cm
JOIN chat_sessions cs    ON cs.id = cm.session_id
JOIN ai_applications app ON app.id = cs.ai_application_id
WHERE cm.created_at > NOW() - INTERVAL '30 days'
GROUP BY app.name
ORDER BY total_tokens DESC;
```

### 6.3 文档版本历史

```sql
SELECT
    dv.version_number, dv.status,
    dv.chunk_count, dv.page_count,
    dv.change_summary,
    u.username AS created_by,
    dv.created_at
FROM document_versions dv
LEFT JOIN users u ON u.id = dv.created_by
WHERE dv.document_id = $1
ORDER BY dv.version_number DESC;
```

### 6.4 AI 应用列表 + 绑定资源详情 (★V2)

```sql
SELECT
    app.id, app.name, app.description, app.status,
    kb.name AS kb_name,
    wf.name AS workflow_name, wf.type AS workflow_type,
    m.display_name AS model_name, m.provider,
    pt.name AS prompt_name,
    app.created_at
FROM ai_applications app
JOIN knowledge_bases kb  ON kb.id = app.knowledge_base_id
JOIN workflows wf        ON wf.id = app.workflow_id
JOIN models m            ON m.id = app.model_id
LEFT JOIN prompt_templates pt ON pt.id = app.prompt_template_id
WHERE app.status = 'active'
ORDER BY app.created_at DESC;
```

### 6.5 AI 应用绑定的工具列表 (★V3)

```sql
SELECT
    t.name, t.type, t.display_name, t.description,
    at.config AS tool_override_config
FROM ai_application_tools at
JOIN tools t ON t.id = at.tool_id
WHERE at.application_id = $1
  AND t.is_active = TRUE
ORDER BY t.type, t.name;
```

### 6.6 Chat Session 消息 + Citation

```sql
SELECT
    cm.role, cm.content, cm.citations, cm.metadata, cm.created_at
FROM chat_messages cm
WHERE cm.session_id = $1
ORDER BY cm.created_at;
```

### 6.7 Workflow 图结构查询 (★V2)

```sql
-- 查询 Workflow 的所有 Nodes
SELECT id, type, label, position_x, position_y, config
FROM workflow_nodes
WHERE workflow_id = $1
ORDER BY type, label;

-- 查询 Workflow 的所有 Edges
SELECT we.id, we.label, we.condition,
       sn.label AS source_label, tn.label AS target_label
FROM workflow_edges we
JOIN workflow_nodes sn ON sn.id = we.source_node_id
JOIN workflow_nodes tn ON tn.id = we.target_node_id
WHERE we.workflow_id = $1;
```

### 6.8 Workflow Execution 追踪 (★V2)

```sql
SELECT
    we.id, we.status, we.duration_ms, we.error_message,
    we.input->>'question' AS question,
    we.node_steps,
    app.name AS application_name,
    wf.name AS workflow_name,
    we.started_at, we.completed_at
FROM workflow_executions we
LEFT JOIN ai_applications app ON app.id = we.application_id
LEFT JOIN workflows wf ON wf.id = we.workflow_id
WHERE we.session_id = $1
ORDER BY we.created_at DESC;
```

### 6.9 模型列表 (按类型筛选) (★V2)

```sql
SELECT
    m.id, m.provider, m.model_name, m.type, m.display_name,
    m.config, m.is_active,
    ak.name AS api_key_name
FROM models m
LEFT JOIN api_keys ak ON ak.id = m.api_key_id
WHERE m.type = $1               -- 'chat' | 'embedding' | 'rerank'
  AND m.is_active = TRUE
ORDER BY m.provider, m.model_name;
```

### 6.10 审计日志 (按知识库筛选)

```sql
SELECT
    al.action, al.entity_type, al.details,
    al.ip_address, al.created_at,
    u.username
FROM audit_logs al
LEFT JOIN users u ON u.id = al.user_id
WHERE al.kb_id = $1
ORDER BY al.created_at DESC
LIMIT 50;
```

### 6.11 Job 进度 (支持重试)

```sql
SELECT
    j.id, j.job_type, j.status, j.progress,
    j.step_description, j.retry_count,
    j.started_at,
    d.name AS document_name,
    dv.version_number
FROM index_jobs j
JOIN documents d ON d.id = j.document_id
LEFT JOIN document_versions dv ON dv.id = j.version_id
WHERE j.status IN ('PENDING', 'RUNNING')
ORDER BY j.created_at DESC;
```

---

## 7. 向量维度兼容策略 — 向量解耦独立表 ★

不同 Embedding 模型输出不同维度, 不同知识库可能使用不同模型:

| Provider | Model | 维度 |
|----------|-------|------|
| OpenAI | text-embedding-ada-002 | 1536 |
| OpenAI | text-embedding-3-small | 1536 |
| OpenAI | text-embedding-3-large | 3072 |
| BGE | bge-large-zh-v1.5 | 1024 |
| BGE | bge-m3 | 1024 |
| DashScope | text-embedding-v3 | 1024 |

### 推荐: chunk_embeddings 独立表 (多模型并存 + kb_id 冗余, 零锁表)

```sql
-- 向量独立存储, 按模型名隔离 + kb_id 冗余 — 避免 ALTER TABLE 锁表 + 加速 KB 过滤
CREATE TABLE chunk_embeddings (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    chunk_id        UUID         NOT NULL REFERENCES document_chunks(id) ON DELETE CASCADE,
    model_name      VARCHAR(64)  NOT NULL,                        -- 'text-embedding-3-small', 'bge-m3'
    embedding       vector(3072) NOT NULL,                        -- 最大维度兼容
    kb_id           UUID         NOT NULL REFERENCES knowledge_bases(id) ON DELETE CASCADE, -- ★
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),

    UNIQUE (chunk_id, model_name)                                 -- 一个 Chunk 一个模型一条向量
);

-- HNSW 索引
CREATE INDEX idx_chunk_embeddings_vector ON chunk_embeddings
    USING hnsw (embedding vector_cosine_ops)
    WITH (m = 16, ef_construction = 200);

CREATE INDEX idx_chunk_embeddings_chunk_id ON chunk_embeddings(chunk_id);
CREATE INDEX idx_chunk_embeddings_model   ON chunk_embeddings(model_name);
CREATE INDEX idx_chunk_embeddings_kb_id   ON chunk_embeddings(kb_id);       -- ★ 加速 KB 过滤

COMMENT ON TABLE chunk_embeddings IS '向量独立表 — 多 Embedding 模型并存, 冗余 kb_id 加速 KB 级向量检索过滤';
```

**优势:**
- 新增模型只需 INSERT, 无需 DDL
- 不同 KB 用不同模型, 向量并存互不干扰
- 废弃模型直接 DELETE, 不影响其他模型
- `document_chunks` 表不再包含 `embedding` 列, 结构更清晰
- ★ **kb_id 冗余**: 向量检索时直接按 kb_id 过滤, 避免跨 document_chunks→documents 回表 JOIN 导致全表 HNSW 扫描

### 备选: document_chunks 内置向量 (简化版, 单模型场景)

如果只用一个 Embedding 模型, 保留 `document_chunks.embedding vector(3072)` 硬编码即可, 跳过 chunk_embeddings 表。

---

## 8. Model vs API Key 关系说明 (★ V2)

```
┌─────────────────────────────────────────────────────────┐
│                    Model Center 分层设计                  │
│                                                         │
│  api_keys (凭证层)          models (注册层)              │
│  ┌──────────────────┐      ┌──────────────────────┐     │
│  │ provider: openai │◄─────│ api_key_id FK        │     │
│  │ name: "生产Key"   │      │ provider: openai     │     │
│  │ api_key: sk-xxx  │      │ model_name: gpt-4o   │     │
│  │ base_url: null   │      │ type: chat           │     │
│  └──────────────────┘      │ display_name: GPT-4o │     │
│         │                  │ config: {...}        │     │
│         │                  └──────────────────────┘     │
│         │                                               │
│         │           ┌──────────────────────┐            │
│         └──────────►│ api_key_id FK        │            │
│                     │ provider: openai     │            │
│                     │ model_name: text-... │            │
│                     │ type: embedding      │            │
│                     │ display_name: ...    │            │
│                     └──────────────────────┘            │
│                                                         │
│  职责分离:                                               │
│  - api_keys: 只管 "密钥是什么" (加密存储)                  │
│  - models:   只管 "有哪些模型、什么能力" (注册/发现)        │
│  - 一个 api_key 可被同 Provider 的多个 model 共享         │
└─────────────────────────────────────────────────────────┘
```

---

## 9. 数据迁移策略

```
──────────────────────────────────────────────────────────
V1.0 初始 (Knowledge Platform — 当前完整设计):
──────────────────────────────────────────────────────────
  - users, knowledge_bases (含 embedding_model, retrieval_strategy), kb_permissions
  - documents (含 kb_id, current_version_id)
  - document_versions, document_chunks (version_id + parent_chunk_id, HNSW 索引)
  - chunk_embeddings (向量独立表, 多模型并存, kb_id 冗余)
  - index_jobs (含 retry_count, version_id, 活跃 Job 唯一约束防重)
  - chat_sessions (含 workflow_type, workflow_id, ai_application_id)
  - chat_messages (含 citations + Token 统计 prompt/completion/total_tokens)
  - prompt_templates, prompt_template_versions
  - workflows (rag/reflection/rewoo/multi_agent)
  - audit_logs (建议: 生产环境移除物理外键 + 按月表分区), api_keys (含 model, base_url), system_settings (单行 JSONB)
  - RLS 策略 (documents, document_chunks, chat_sessions, chat_messages)

  确认: api_keys.base_url ✅ (支持 OpenAI/Azure/DashScope 多端点), chat_sessions.ai_application_id ✅
  说明: V1 聚焦 Knowledge Base + RAG Chat, 所有表均在 V1 创建

──────────────────────────────────────────────────────────
V2.0 (AI Application Platform):
──────────────────────────────────────────────────────────
  新增表 (DDL):
  - ai_applications       ★ AI 应用 = KB + Workflow + Model + Prompt
  - models                ★ 模型注册中心 (与 api_keys 凭证解耦)
  - workflow_nodes        ★ Workflow 图节点
  - workflow_edges        ★ Workflow 图边
  - workflow_executions   ★ Workflow 执行追踪

  修改表 (ALTER):
  - chat_sessions 新增 ai_application_id 列 (FK → ai_applications)
  - chat_messages.metadata 新增 execution_id 字段 (约定, JSONB 内)
  - audit_logs 新增枚举值: AI_APP_CREATE/DELETE/UPDATE, MODEL_REGISTER/DELETE,
    WORKFLOW_CREATE/UPDATE/EXECUTE

  数据迁移:
  - 已有 api_keys 数据不动, models 表作为新注册入口
  - 可将 api_keys 中已有的 provider+model 信息回填到 models 表 (可选脚本)

──────────────────────────────────────────────────────────
V3.0 (Agent Platform):
──────────────────────────────────────────────────────────
  新增表 (DDL):
  - tools                 ★ 工具注册中心
  - ai_application_tools  ★ AI 应用与工具 N:M 关联

  新增 Worker:
  - Tool Execution Worker (独立进程, 沙箱执行)

  修改表 (ALTER):
  - audit_logs 新增枚举值: TOOL_REGISTER, TOOL_DELETE, TOOL_EXECUTE

──────────────────────────────────────────────────────────
V4.0 (Hybrid Search + Rerank):
──────────────────────────────────────────────────────────
  - document_chunks 已有 tsv (tsvector) 列 → 启用 SparseRetriever
  - system_settings.config 已有 rerank 完整配置 → 启用 RerankerService
  - 无需 DDL 变更

──────────────────────────────────────────────────────────
V5.0 (Knowledge Graph):
──────────────────────────────────────────────────────────
  - 新增 entities, relations 表
  - 或引入 Neo4j

──────────────────────────────────────────────────────────
V6.0 (Multi Agent + MCP):
──────────────────────────────────────────────────────────
  - workflows.type 新增: tool_calling, mcp_agent
  - 新增 agent_logs, agent_tasks 表
  - 新增 mcp_servers 表
```
