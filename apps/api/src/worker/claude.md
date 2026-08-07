# worker 模块开发

## 1. 模块概述（Overview）

Worker 进程 (独立, 消费 Event)，主要消费主进程发出 Event;

- 模块名称：worker

- 模块标识（唯一 key）：worker

- 模块职责：Worker 进程 (独立, 消费 Event)

- 核心能力：Index Pipeline、embedding、 独立 Queue、软删除 + 异步 GC 策略、Redis 缓存


## 2. 整体架构设计（Architecture）

### 2.1 事件驱动 Index Pipeline

```
┌──────────────────────────────────────────────────┐
│                  NestJS API                      │
│                                                  │
│  DocumentController.upload()                     │
│       │                                          │
│       ├── 1. 上传 MinIO (save file)               │
│       ├── 2. INSERT document (status=UPLOADING)  │
│       ├── 3. INSERT document_version             │
│       ├── 4. INSERT audit_log                    │
│       └── 5. eventBus.emit('document.uploaded')  │
│                     │                            │
└─────────────────────┼────────────────────────────┘
                      │
          ════════════╪════════════
          │       Event Bus       │
          ════════════╪════════════
                      │
                      ▼
┌──────────────────────────────────────────────────┐
│       Index Pipeline (独立 Worker, 多 Queue)      │
│                                                  │
│  Queue: index (3 并发)                            │
│  @OnEvent('document.uploaded')                   │
│  IndexProcessor.handle()                         │
│       │                                          │
│       ├── 1. UPDATE document → PROCESSING        │
│       ├── 2. CREATE index_job (PENDING → RUNNING)│
│       ├── 3. MinIO download → file buffer        │
│       │                                          │
│       ├── 4. Loader (格式无关, 策略模式)            │
│       │    ├── PDFLoader  → pages[]              │
│       │    ├── WordLoader → pages[]  (V2.5)      │
│       │    ├── MarkdownLoader → pages[] (V2.5)   │
│       │    ├── ExcelLoader → rows[]   (V2.5)     │
│       │    └── HTMLLoader → text      (V2.5)     │
│       │                                          │
│       ├── 5. Parser (提取纯文本 + 元数据)           │
│       │    └── 结构化 text + page/row metadata    │
│       │                                          │
│       ├── 6. TextSplitter → chunks[]             │
│       │    Update job.progress (0→50%)           │
│       │                                          │
│       ├── 7. Persist: INSERT document_chunks     │
│       │    (batch, 含 parent_chunk_id)           │
│       │    Update job.progress (50→60%)          │
│       │                                          │
│       └── 8. Enqueue → embedding Queue           │
│                                                  │
│  ──────────────────────────────────────────────  │
│                                                  │
│  Queue: embedding (5 并发, ★ 独立 Queue)          │
│  EmbeddingProcessor.handle()                     │
│       │                                          │
│       ├── 9. EmbeddingService.embed(chunks)      │
│       │    Update job.progress (60→95%)          │
│       ├── 10. Persist: INSERT chunk_embeddings   │
│       ├── 11. UPDATE document → READY            │
│       ├── 12. UPDATE job → DONE (progress=100)   │
│       └── 13. INSERT audit_log                   │
│                                                  │
│  设计要点:                                        │
│  - index Queue: 快速处理文档解析, CPU 密集型         │
│  - embedding Queue: 调用外部 API, IO 密集型         │
│  - 两个 Queue 独立扩缩容, 互不阻塞                   │
└──────────────────────────────────────────────────┘
```

### 2.2 队列设计 (增强 — 独立 Queue 粒度)

| Queue | 触发 Event | 用途 | 并发 | 类型 | 阶段 |
|-------|-----------|------|------|------|------|
| `index` | `document.uploaded` | Loader→Parser→Splitter→Persist(chunks) | 3 | CPU 密集型 | V1 |
| `embedding` | `index.chunks_persisted` | Embedding API 调用 → 向量持久化 | 5 | IO 密集型 | V1 |
| `reindex` | `index.requested` | 重新索引已有文档 (复用 index+embedding) | 2 | 混合 | V1 |
| `delete-chunks` | `document.deleted` | 清理 Chunks + 向量 | 2 | IO 密集型 | V1 |
| `cleanup` | `version.deleted` / `document.deleted` | ★ 异步 GC: 软删后清 MinIO + 向量 | 1 | IO 密集型 | V1 |
| `ocr` (后续) | `image.uploaded` | OCR 图片 PDF | 1 | CPU 密集型 | V3 |
| `summary` (后续) | `index.completed` | 生成文档摘要 | 1 | IO 密集型 | V2 |
| `workflow-exec` (V2) | `workflow.execute` | LangGraph Runtime 执行 Workflow | 3 | 混合 | **V2** |
| `tool-exec` (V3) | `tool.execute` | 沙箱执行工具 (SQL/HTTP/Search) | 3 | 混合 | **V3** |

**设计要点:**
- `index` Queue (CPU 密集) 和 `embedding` Queue (IO 密集) 独立扩缩容, 互不阻塞
- `embedding` Queue 并发数设为 5 — Embedding API 有 rate limit, 可通过并发数控制调用频率
- `cleanup` Queue 统一管理所有异步清理任务, 避免与核心业务争抢资源
- 新增格式 (Word/Excel/Markdown) 只需注册 Loader, 无需修改任何队列

### 2.3 软删除 + 异步 GC 策略

```
用户/系统触发删除
       │
       ▼
┌──────────────────────────────────────┐
│  1. API: UPDATE status → DELETED     │  ← 软删, 瞬时完成
│  2. API: eventBus.emit('deleted')    │
│  3. API: 返回 200 OK (不等待清理)      │
└──────────────────┬───────────────────┘
                   │
       ════════════╪═════════════
       │       Event Bus        │
       ════════════╪═════════════
                   │
                   ▼
┌──────────────────────────────────────┐
│  4. GC Worker (clean-orphan-chunks): │
│     ├── DELETE document_chunks       │  ← 批量清向量 (异步)
│     ├── MinIO deleteObjects()        │  ← 清对象存储文件
│     ├── UPDATE version → GC_DONE     │
│     └── INSERT audit_log             │
└──────────────────────────────────────┘

优势: 大文档删除不阻塞 API, 失败可重试, MinIO 误删可恢复(软删窗口期)
```

### 2.4 Workflow Execution Worker (V2)

```
Chat / AI Application 发来请求
       │
       ▼
┌──────────────────────────────────────────────────┐
│  1. API: 接收用户消息                              │
│  2. API: 查找 AI Application 配置                 │
│     ├── 绑定 KB → Retrieval Pipeline             │
│     ├── 绑定 Workflow → 选择 Strategy             │
│     └── 绑定 Model + Prompt + Tools              │
│  3. API: eventBus.emit('workflow.execute')       │
└──────────────────┬───────────────────────────────┘
                   │
       ════════════╪═════════════
       │       Event Bus        │
       ════════════╪═════════════
                   │
                   ▼
┌──────────────────────────────────────────────────┐
│  4. Workflow Exec Worker:                        │
│     ├── INSERT workflow_execution (RUNNING)      │
│     ├── LangGraph StateGraph 初始化               │
│     ├── 逐 Node 执行:                             │
│     │   ├── RetrieverNode → KB.search()          │
│     │   ├── LLMNode → ModelService.chat()        │
│     │   ├── ToolNode → ToolExecutor.run()        │
│     │   ├── JudgeNode → Reflection               │
│     │   └── ...                                  │
│     ├── 记录 per-node steps + duration            │
│     ├── UPDATE workflow_execution → DONE         │
│     └── SSE Streaming 返回结果                    │
└──────────────────────────────────────────────────┘
```

### 2.5 Event 类型定义 (增强)

```typescript
enum DocumentEvent {
  DOCUMENT_UPLOADED  = 'document.uploaded',   // → Index Worker
  DOCUMENT_DELETED   = 'document.deleted',    // → Delete-Chunks + GC Worker
  VERSION_DELETED    = 'version.deleted',     // → GC Worker (clean-orphan-chunks)
  INDEX_REQUESTED    = 'index.requested',     // → Reindex Worker
  INDEX_COMPLETED    = 'index.completed',     // → Summary Worker (后续)
  INDEX_FAILED       = 'index.failed',
  IMAGE_UPLOADED     = 'image.uploaded',      // → OCR Worker (后续)
}

// ★ 新增
enum WorkflowEvent {
  WORKFLOW_EXECUTE   = 'workflow.execute',    // → Workflow Exec Worker (V2)
  WORKFLOW_COMPLETED = 'workflow.completed',
  WORKFLOW_FAILED    = 'workflow.failed',
}

enum ToolEvent {
  TOOL_EXECUTE       = 'tool.execute',        // → Tool Exec Worker (V3)
  TOOL_COMPLETED     = 'tool.completed',
  TOOL_FAILED        = 'tool.failed',
}
```

### 2.6 后续升级路径 (V2)

```
当前: NestJS EventEmitter + BullMQ (同进程 / Redis)
  │
  ├── 第二阶段: RabbitMQ (独立 Broker, 更可靠)
  │
  └── 第三阶段: Kafka + Schema Registry (大规模, 多消费者)
```


### 2bis. Redis 缓存分层策略 (并发控制 + 成本优化)

#### 2bis.1 缓存分层架构

```
┌──────────────────────────────────────────────────────────┐
│                      Redis (BullMQ + Cache + Lock)        │
│                                                          │
│  ┌─ Layer 1: Session 分布式锁 (Redlock) ──────────────┐  │
│  │  Key:    lock:session:{session_id}                  │  │
│  │  TTL:    30s (自动释放)                              │  │
│  │  用途:   同一 Session 同一时间只允许一个 LLM 请求      │  │
│  │  场景:   用户快速连续点击发送, 防止并发 LLM 调用       │  │
│  └────────────────────────────────────────────────────┘  │
│                                                          │
│  ┌─ Layer 2: Embedding 缓存 ──────────────────────────┐  │
│  │  Key:    embed:{sha256(query)}:{model_name}         │  │
│  │  Value:  vector(float32[])                          │  │
│  │  TTL:    24h (FAQ 问题长期有效)                      │  │
│  │  用途:   重复 Query 直接返回缓存向量, 跳过 API 调用    │  │
│  │  收益:   FAQ 场景 Embedding API 成本降低 60-80%       │  │
│  └────────────────────────────────────────────────────┘  │
│                                                          │
│  ┌─ Layer 3: Retrieval 结果缓存 (可选) ────────────────┐  │
│  │  Key:    retrieval:{kb_id}:{sha256(query)}          │  │
│  │  Value:  chunk_ids[] + scores[]                     │  │
│  │  TTL:    5min (热数据短期有效)                        │  │
│  │  用途:   同 KB 内重复查询直接返回检索结果              │  │
│  └────────────────────────────────────────────────────┘  │
│                                                          │
│  ┌─ Layer 4: Rate Limiter ────────────────────────────┐  │
│  │  Key:    rate:{user_id}:{endpoint}                  │  │
│  │  算法:   Sliding Window Log                          │  │
│  │  用途:   用户级/API Key 级频率限制                    │  │
│  └────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────┘
```

#### 2bis.2 Session 分布式锁流程

```
用户发送消息 (session_id = "abc123")
       │
       ▼
┌──────────────────────────────────────┐
│  1. Redis: SET lock:session:abc123   │
│            NX PX 30000 (30s TTL)     │
│       │                              │
│       ├── OK (获取锁成功) → 继续执行   │
│       │                              │
│       └── nil (锁已被持有) → 返回     │
│           HTTP 429 "上一个问题正在处理中"│
└──────────────────┬───────────────────┘
                   │
                   ▼
┌──────────────────────────────────────┐
│  2. 执行完整 RAG Pipeline             │
│     Retriever → Rerank → LLM → SSE   │
└──────────────────┬───────────────────┘
                   │
                   ▼
┌──────────────────────────────────────┐
│  3. Redis: DEL lock:session:abc123   │
│     (或等 30s TTL 自动过期)           │
└──────────────────────────────────────┘

优势: 用户快速连点发送按钮不会产生多个并发 LLM 调用, 节省 Token 成本
```

#### 2bis.3 Embedding 缓存流程

```
用户 Query: "请假流程是什么?"
       │
       ▼
┌──────────────────────────────────────┐
│  1. hash = SHA256("请假流程是什么?")   │
│     key = "embed:{hash}:bge-m3"      │
└──────────────────┬───────────────────┘
                   │
                   ▼
┌──────────────────────────────────────┐
│  2. Redis: GET embed:{hash}:bge-m3   │
│       │                              │
│       ├── HIT → 直接返回缓存向量       │
│       │        跳过 Embedding API 调用 │
│       │                              │
│       └── MISS → Embedding API       │
│                  → Redis SETEX 24h   │
└──────────────────────────────────────┘

收益分析:
  - Embedding API 调用减少 60-80% (FAQ/重复场景)
  - 用户感知延迟降低 ~200ms (网络 RTT)
  - 缓存 Key 设计: 包含 model_name, 不同模型独立缓存
```

## 3. 核心功能清单（Features）

- 功能1：主进程 eventBus.emit('document.uploaded') 

- 功能2：Index @OnEvent('document.uploaded') ，处理 事件驱动 Index Pipeline中 Index Pipeline (独立 Worker, 多 Queue) 设计功能

- 功能3：Queue: embedding (5 并发, ★ 独立 Queue)

- 功能4：软删除 + 异步 GC 策略

- 功能5：Redis （BullMQ）缓存、Session 分布式锁流程

- 功能6：客户提问问题 Embedding 方法实现以及缓存流程

注意：2.4 Workflow Execution Worker (V2) 功能本次不进行实现

## 4 整体架构设计

架构设计文档：ARCHITECTURE.md

## 5. 数据结构/类型定义（Schema / Type）

数据库设计文档：DATABASE.md

## 6. 问题
1、src/worker/pipelines/index-pipeline.ts 中 const mimeType = doc?.mimeType ?? ''; pdf文件数据库中存放的是：application/msword