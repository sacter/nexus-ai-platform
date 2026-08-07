# Worker 模块实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在 `apps/api` 内实现事件驱动 + BullMQ 的 Index/Embedding/GC Worker 模块，覆盖 `apps/api/src/worker/claude.md` 的 6 项核心功能。

**Architecture:** NestJS 同进程架构（EventEmitter2 作为事件总线 + BullMQ 作为队列）。API 层 `DocumentService` 发出 `document.uploaded` / `document.deleted` 事件；Worker 模块内 `@OnEvent` 消费者把事件入队到独立 Queue（`index`/`embedding`/`reindex`/`delete-chunks`/`cleanup`），BullMQ Worker 按各自并发数消费。Index Pipeline 走 Loader(策略) → Parser → Splitter → Persist → Enqueue embedding；Embedding 完成后文档置 READY、job 置 DONE。embedding 模型选择统一收敛到 `model-provider`（统一模型提供文件），查询向量带 Redis 缓存（`embed:{sha256(query)}:{model}`，24h TTL），Session 分布式锁走 `lock:session:{id}`。

**Tech Stack:** NestJS 11、Prisma 7 (pgvector)、BullMQ 5、ioredis、@nestjs/event-emitter、pdf-parse、MinIO。

---

## 范围检查

设计文档核心功能清单对应本计划任务：

| 设计文档功能 | 实现位置 | 任务 |
|---|---|---|
| 功能1 主进程 eventBus.emit('document.uploaded') | `infrastructure/event-bus` + `DocumentService.saveMeta` | Task 3, 13 |
| 功能2 Index Pipeline (index Queue, 3 并发) | `worker/pipelines/*` + `index.consumer` | Task 8-12, 13 |
| 功能3 embedding Queue (5 并发) | `worker/consumers/embedding.consumer` | Task 13 |
| 功能4 软删除 + 异步 GC | `gc.consumer` + `delete-chunks`/`cleanup` Queue | Task 13 |
| 功能5 Redis (BullMQ) 缓存 + Session 分布式锁 | `infrastructure/redis` + `session-lock.service` | Task 2, 14 |
| 功能6 客户提问 Embedding + 缓存流程 | `EmbeddingService.embedQuery` | Task 7 |
| ★ 统一 embedding 模型提供文件 | `modules/model-provider/model-provider.ts` | Task 5 |

**不在本次范围**：2.4 Workflow Execution Worker (V2)、OCR (V3)、Summary (V2)、Retrieval Pipeline 本体（只提供 query 侧 embed 方法）。

**设计决策（严格依据 worker/claude.md）：**
1. Worker 运行在 API 同进程（"当前: NestJS EventEmitter + BullMQ (同进程 / Redis)"），`apps/worker` 独立进程暂不动。
2. 软删除即触发异步 GC：软删后 `document.deleted` → `delete-chunks`（删 chunks+向量）与 `cleanup`（删 MinIO 文件 + audit_log）并行执行，文档记录保留 DELETED 状态用于追踪。
3. Embedding 向量写入 `chunk_embeddings`（`vector(3072)`）走 Prisma 原生 SQL（`::vector` 强转），因为 Prisma 将 vector 列声明为 `Unsupported`。
4. 模型解析优先级：`knowledge_bases.embedding_model` → 环境变量默认值。

---

## 文件结构

**新建（infrastructure）：**
- `apps/api/src/infrastructure/redis/redis.module.ts` — Redis 全局模块
- `apps/api/src/infrastructure/redis/redis.service.ts` — ioredis 封装（get/set/锁）
- `apps/api/src/infrastructure/queue/queue.constants.ts` — 队列名 + 并发数
- `apps/api/src/infrastructure/queue/queue.module.ts`
- `apps/api/src/infrastructure/queue/queue.service.ts` — BullMQ Queue 生产者 + Redis 连接
- `apps/api/src/infrastructure/event-bus/event-bus.module.ts` — EventEmitter2 模块
- `apps/api/src/infrastructure/event-bus/event-bus.service.ts` — 事件封装
- `apps/api/src/infrastructure/event-bus/events/document-uploaded.event.ts`
- `apps/api/src/infrastructure/event-bus/events/document-deleted.event.ts`
- `apps/api/src/infrastructure/event-bus/events/index-requested.event.ts`
- `apps/api/src/infrastructure/event-bus/events/chunks-persisted.event.ts`

**新建（modules）：**
- `apps/api/src/modules/model-provider/model-provider.ts` — ★ 统一模型提供文件
- `apps/api/src/modules/model-provider/model-provider.service.ts`
- `apps/api/src/modules/model-provider/model-provider.module.ts`
- `apps/api/src/modules/embedding/providers/embedding-provider.interface.ts`（填充空文件）
- `apps/api/src/modules/embedding/providers/ollama-embedding.provider.ts`（填充空文件）
- `apps/api/src/modules/embedding/providers/openai-embedding.provider.ts`
- `apps/api/src/modules/embedding/embedding.service.ts`（重写空文件）
- `apps/api/src/modules/embedding/embedding.module.ts`（重写）

**新建（worker）：**
- `apps/api/src/worker/session-lock.service.ts`

- `apps/api/src/worker/pipelines/index-pipeline.ts`（填充空文件）
- `apps/api/src/worker/pipelines/reindex-pipeline.ts`（填充空文件）

- `apps/api/src/worker/pipelines/loaders/loader.interface.ts`（填充空文件）
- `apps/api/src/worker/pipelines/loaders/pdf-loader.ts`（填充空文件）
- `apps/api/src/worker/pipelines/loaders/markdown-loader.ts`
- `apps/api/src/worker/pipelines/loaders/text-loader.ts`

- `apps/api/src/worker/pipelines/parsers/parser.interface.ts`
- `apps/api/src/worker/pipelines/parsers/text-parser.ts`

- `apps/api/src/worker/pipelines/splitters/splitter.interface.ts`
- `apps/api/src/worker/pipelines/splitters/text-splitter.ts`

- `apps/api/src/worker/pipelines/embedders/embedder.interface.ts`
- `apps/api/src/worker/pipelines/embedders/batch-embedder.ts`

- `apps/api/src/worker/pipelines/persist/persist.service.ts`
- `apps/api/src/worker/pipelines/persist/batch-writer.ts`

- `apps/api/src/worker/consumers/index.consumer.ts`（填充空文件）
- `apps/api/src/worker/consumers/embedding.consumer.ts`（填充空文件）
- `apps/api/src/worker/consumers/gc.consumer.ts`
- `apps/api/src/worker/consumers/reindex.consumer.ts`

**修改：**
- `apps/api/src/worker/worker.module.ts` — 组装所有 provider/消费者
- `apps/api/src/worker/worker.service.ts` — 健康检查/状态暴露
- `apps/api/src/worker/worker.controller.ts` — 删除（worker 非 HTTP 模块）
- `apps/api/src/infrastructure/minio/minio.service.ts` — 新增 `downloadObject()`
- `apps/api/src/modules/knowledge/document/document.service.ts` — saveMeta/softDelete/requestReindex 发事件
- `apps/api/src/modules/knowledge/document/document.controller.ts` — 新增 `POST :id/reindex`
- `apps/api/src/modules/knowledge/document/document.module.ts` — import EventBusModule
- `apps/api/src/app.module.ts` — 注册新模块
- `apps/api/package.json` — 新增依赖
- `.env` / `.env.example` — 新增 embedding 配置

---

## Task 1: 依赖与环境配置

**Files:**
- Modify: `apps/api/package.json`
- Modify: `.env`
- Modify: `.env.example`
- Modify: `apps/api/src/infrastructure/minio/minio.service.ts`

- [ ] **Step 1: 安装依赖**

Run:
```bash
cd /Users/aibee/Documents/code/demo/agent/nexus-ai-platform && pnpm --filter @nexus/api add @nestjs/event-emitter@^2.1.1 pdf-parse@^1.1.1
```

Expected: `apps/api/package.json` 的 `dependencies` 出现 `@nestjs/event-emitter` 与 `pdf-parse`，pnpm 安装成功。

- [ ] **Step 2: 追加 .env 配置**

在 `.env` 末尾追加（同内容追加到 `.env.example`）：

```env
# ===========================================
# Embedding 模型（统一模型提供文件读取）
# ===========================================
EMBEDDING_DEFAULT_PROVIDER=ollama
EMBEDDING_DEFAULT_MODEL=bge-m3
EMBEDDING_DIMENSION=1024
OLLAMA_BASE_URL=http://localhost:11434
OPENAI_BASE_URL=https://api.openai.com/v1
OPENAI_API_KEY=
```

- [ ] **Step 3: 给 MinioService 新增对象下载方法**

在 `apps/api/src/infrastructure/minio/minio.service.ts` 的 `objectExists()` 方法后插入：

```typescript
  /**
   * 下载 MinIO 对象为 Buffer（Worker 解析用）
   */
  async downloadObject(objectKey: string): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];
      this.client
        .getObject(this.bucket, objectKey)
        .then((stream) => {
          stream.on('data', (chunk) => chunks.push(chunk as Buffer));
          stream.on('end', () => resolve(Buffer.concat(chunks)));
          stream.on('error', reject);
        })
        .catch(reject);
    });
  }
```

- [ ] **Step 4: 构建验证**

Run: `cd apps/api && npx tsc --noEmit -p tsconfig.build.json`
Expected: 无类型错误（若 pdf-parse 无类型定义，在 `src/types/` 加 `pdf-parse.d.ts`）。

- [ ] **Step 5: Commit**

```bash
git add apps/api/package.json pnpm-lock.yaml .env .env.example apps/api/src/infrastructure/minio/minio.service.ts
git commit -m "chore: worker 模块依赖与 MinIO 下载方法"
```

---

## Task 2: Redis 基础设施（缓存 + 分布式锁）

**Files:**
- Create: `apps/api/src/infrastructure/redis/redis.module.ts`
- Create: `apps/api/src/infrastructure/redis/redis.service.ts`
- Test: `apps/api/src/infrastructure/redis/redis.service.spec.ts`

- [ ] **Step 1: 写失败测试**

```typescript
import { Test } from '@nestjs/testing';
import { RedisService } from './redis.service';

describe('RedisService', () => {
  let service: RedisService;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [RedisService],
    }).compile();
    service = moduleRef.get(RedisService);
    // 用 mock 客户端替换，避免真实连接
    const mock = {
      get: jest.fn(),
      set: jest.fn(),
      del: jest.fn(),
      connect: jest.fn(),
      quit: jest.fn(),
      status: 'ready',
    };
    (service as unknown as { client: unknown }).client = mock;
  });

  it('get 透传 Redis get', async () => {
    (service.getClient() as unknown as { get: jest.Mock }).get.mockResolvedValue('v1');
    await expect(service.get('k')).resolves.toBe('v1');
  });

  it('set 使用 SETEX 写入 TTL', async () => {
    const mock = service.getClient() as unknown as { set: jest.Mock };
    mock.set.mockResolvedValue('OK');
    await service.set('k', 'v', 3600);
    expect(mock.set).toHaveBeenCalledWith('k', 'v', 'EX', 3600);
  });

  it('acquireLock 通过 SET NX PX 加锁', async () => {
    const mock = service.getClient() as unknown as { set: jest.Mock };
    mock.set.mockResolvedValue('OK');
    await expect(service.acquireLock('lock:session:abc', 30000)).resolves.toBe(true);
    expect(mock.set).toHaveBeenCalledWith('lock:session:abc', '1', 'EX', 30, 'NX');
  });

  it('acquireLock 返回 null 时代表锁已被持有', async () => {
    const mock = service.getClient() as unknown as { set: jest.Mock };
    mock.set.mockResolvedValue(null);
    await expect(service.acquireLock('lock:session:abc', 30000)).resolves.toBe(false);
  });

  it('releaseLock 删除锁 key', async () => {
    const mock = service.getClient() as unknown as { del: jest.Mock };
    mock.del.mockResolvedValue(1);
    await service.releaseLock('lock:session:abc');
    expect(mock.del).toHaveBeenCalledWith('lock:session:abc');
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `cd apps/api && npx jest src/infrastructure/redis/redis.service.spec.ts --no-cache`
Expected: FAIL —— `Cannot find module './redis.service'`。

- [ ] **Step 3: 实现 RedisService**

`apps/api/src/infrastructure/redis/redis.service.ts`：

```typescript
import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import Redis from 'ioredis';

/**
 * Redis 服务（缓存 + 分布式锁）
 *
 * - get/set：带 TTL 的通用缓存（embedding 缓存、检索缓存）
 * - acquireLock/releaseLock：SET NX PX 实现分布式锁（Session 锁）
 * - 供 BullMQ 共享同一个连接配置
 */
@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private client: Redis;

  async onModuleInit() {
    this.client = new Redis({
      host: process.env.REDIS_HOST ?? 'localhost',
      port: parseInt(process.env.REDIS_PORT ?? '6379', 10),
      lazyConnect: true,
      maxRetriesPerRequest: null, // BullMQ 要求 null
      enableReadyCheck: false,
    });
    await this.client.connect();
    this.logger.log('Redis connected');
  }

  async onModuleDestroy() {
    await this.client?.quit();
  }

  getClient(): Redis {
    return this.client;
  }

  async get(key: string): Promise<string | null> {
    return this.client.get(key);
  }

  async set(key: string, value: string, ttlSeconds?: number): Promise<void> {
    if (ttlSeconds) {
      await this.client.set(key, value, 'EX', ttlSeconds);
    } else {
      await this.client.set(key, value);
    }
  }

  async del(key: string): Promise<void> {
    await this.client.del(key);
  }

  /**
   * 获取分布式锁（SET key 1 EX ttlSeconds NX）
   * 返回 true 表示获取成功，false 表示已被持有
   */
  async acquireLock(key: string, ttlMs = 30000): Promise<boolean> {
    const result = await this.client.set(key, '1', 'EX', Math.floor(ttlMs / 1000), 'NX');
    return result === 'OK';
  }

  /** 释放分布式锁 */
  async releaseLock(key: string): Promise<void> {
    await this.client.del(key);
  }
}
```

`apps/api/src/infrastructure/redis/redis.module.ts`：

```typescript
import { Global, Module } from '@nestjs/common';
import { RedisService } from './redis.service';

@Global()
@Module({
  providers: [RedisService],
  exports: [RedisService],
})
export class RedisModule {}
```

- [ ] **Step 4: 运行测试确认通过**

Run: `cd apps/api && npx jest src/infrastructure/redis/redis.service.spec.ts --no-cache`
Expected: PASS（5 个用例）。

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/infrastructure/redis
git commit -m "feat: Redis 缓存与分布式锁基础设施"
```

---

## Task 3: 事件总线（Event Bus）

**Files:**
- Create: `apps/api/src/infrastructure/event-bus/events/document-uploaded.event.ts`
- Create: `apps/api/src/infrastructure/event-bus/events/document-deleted.event.ts`
- Create: `apps/api/src/infrastructure/event-bus/events/index-requested.event.ts`
- Create: `apps/api/src/infrastructure/event-bus/events/chunks-persisted.event.ts`
- Modify: `apps/api/src/infrastructure/event-bus/event-bus.service.ts`（重写占位实现）
- Modify: `apps/api/src/infrastructure/event-bus/event-bus.module.ts`
- Test: `apps/api/src/infrastructure/event-bus/event-bus.service.spec.ts`

- [ ] **Step 1: 定义事件常量与载荷**

`events/document-uploaded.event.ts`：

```typescript
/** 文档上传完成事件 —— 触发 Index Worker */
export const DOCUMENT_UPLOADED = 'document.uploaded';

export interface DocumentUploadedEvent {
  documentId: string;
  versionId: string;
  kbId: string;
}
```

`events/document-deleted.event.ts`：

```typescript
/** 文档软删除事件 —— 触发 Delete-Chunks + GC Worker */
export const DOCUMENT_DELETED = 'document.deleted';

export interface DocumentDeletedEvent {
  documentId: string;
  kbId: string;
}
```

`events/index-requested.event.ts`：

```typescript
/** 重新索引请求事件 —— 触发 Reindex Worker */
export const INDEX_REQUESTED = 'index.requested';

export interface IndexRequestedEvent {
  documentId: string;
  versionId: string;
  kbId: string;
}
```

`events/chunks-persisted.event.ts`：

```typescript
/** 索引分块落库完成事件 */
export const CHUNKS_PERSISTED = 'index.chunks_persisted';

export interface ChunksPersistedEvent {
  documentId: string;
  versionId: string;
  kbId: string;
  chunkIds: string[];
  indexJobId: string;
}
```

- [ ] **Step 2: 写失败测试**

```typescript
import { EventBusService } from './event-bus.service';

describe('EventBusService', () => {
  it('emit 透传 EventEmitter2 的 emitAsync 并返回布尔结果', async () => {
    const emitter = { emitAsync: jest.fn().mockResolvedValue([true]) };
    const service = new EventBusService(emitter as never);
    await service.emit('document.uploaded', { documentId: 'd1' });
    expect(emitter.emitAsync).toHaveBeenCalledWith('document.uploaded', { documentId: 'd1' });
  });

  it('emitSync 透传 EventEmitter2 的 emit', () => {
    const emitter = { emit: jest.fn().mockReturnValue(true) };
    const service = new EventBusService(emitter as never);
    service.emitSync('document.deleted', { documentId: 'd2', kbId: 'k' });
    expect(emitter.emit).toHaveBeenCalledWith('document.deleted', { documentId: 'd2', kbId: 'k' });
  });
});
```

- [ ] **Step 3: 运行测试确认失败**

Run: `cd apps/api && npx jest src/infrastructure/event-bus/event-bus.service.spec.ts --no-cache`
Expected: FAIL —— `Cannot find module './event-bus.service'`（当前为占位 CRUD）。

- [ ] **Step 4: 实现 EventBusService 与模块**

`event-bus.service.ts`（整体替换占位实现）：

```typescript
import { Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';

/**
 * 事件总线 —— 主进程发布事件，Worker 消费者订阅
 *
 * - emit：异步发布（fire-and-forget，Worker 内 await）
 * - emitSync：同步发布（同一事件循环内触发）
 */
@Injectable()
export class EventBusService {
  constructor(private readonly eventEmitter: EventEmitter2) {}

  async emit(event: string, payload: unknown): Promise<boolean> {
    const results = await this.eventEmitter.emitAsync(event, payload);
    return results.every((r) => r !== false);
  }

  emitSync(event: string, payload: unknown): boolean {
    return this.eventEmitter.emit(event, payload);
  }
}
```

`event-bus.module.ts`（整体替换）：

```typescript
import { Global, Module } from '@nestjs/common';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { EventBusService } from './event-bus.service';

@Global()
@Module({
  imports: [
    EventEmitterModule.forRoot({
      wildcard: false,
      delimiter: '.',
      maxListeners: 20,
    }),
  ],
  providers: [EventBusService],
  exports: [EventBusService],
})
export class EventBusModule {}
```

- [ ] **Step 5: 运行测试确认通过**

Run: `cd apps/api && npx jest src/infrastructure/event-bus/event-bus.service.spec.ts --no-cache`
Expected: PASS。

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/infrastructure/event-bus
git commit -m "feat: 事件总线基础设施与事件类型定义"
```

---

## Task 4: BullMQ 队列基础设施

**Files:**
- Create: `apps/api/src/infrastructure/queue/queue.constants.ts`
- Create: `apps/api/src/infrastructure/queue/queue.service.ts`
- Create: `apps/api/src/infrastructure/queue/queue.module.ts`
- Test: `apps/api/src/infrastructure/queue/queue.service.spec.ts`

- [ ] **Step 1: 定义队列常量**

`queue.constants.ts`：

```typescript
/**
 * 队列名与并发配置 —— 独立 Queue 粒度
 * index(CPU)/embedding(IO)/reindex(混合)/delete-chunks(IO)/cleanup(IO) 互不阻塞
 */
export const QUEUE_NAMES = {
  INDEX: 'index',
  EMBEDDING: 'embedding',
  REINDEX: 'reindex',
  DELETE_CHUNKS: 'delete-chunks',
  CLEANUP: 'cleanup',
} as const;

export type QueueName = (typeof QUEUE_NAMES)[keyof typeof QUEUE_NAMES];

export const QUEUE_CONCURRENCY: Record<QueueName, number> = {
  [QUEUE_NAMES.INDEX]: 3,
  [QUEUE_NAMES.EMBEDDING]: 5,
  [QUEUE_NAMES.REINDEX]: 2,
  [QUEUE_NAMES.DELETE_CHUNKS]: 2,
  [QUEUE_NAMES.CLEANUP]: 1,
};
```

- [ ] **Step 2: 写失败测试**

```typescript
import { QueueService } from './queue.service';

jest.mock('bullmq', () => {
  return {
    Queue: jest.fn().mockImplementation((name: string, opts: unknown) => ({ name, opts })),
  };
});

describe('QueueService', () => {
  let service: QueueService;

  beforeEach(() => {
    service = new QueueService();
  });

  it('getQueue 返回同名 BullMQ Queue（懒创建）', () => {
    const q1 = service.getQueue('embedding');
    const q2 = service.getQueue('embedding');
    expect(q1).toBe(q2);
    expect((q1 as { name: string }).name).toBe('embedding');
  });

  it('队列配置含并发数', () => {
    const q = service.getQueue('index') as { opts: { defaultJobOptions: unknown } };
    expect(q.opts).toBeDefined();
  });
});
```

- [ ] **Step 3: 运行测试确认失败**

Run: `cd apps/api && npx jest src/infrastructure/queue/queue.service.spec.ts --no-cache`
Expected: FAIL —— `Cannot find module './queue.service'`（当前为占位）。

- [ ] **Step 4: 实现 QueueService 与模块**

`queue.service.ts`（整体替换占位实现）：

```typescript
import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Queue } from 'bullmq';
import Redis from 'ioredis';
import { QUEUE_NAMES, QUEUE_CONCURRENCY, QueueName } from './queue.constants';

/**
 * BullMQ 队列生产者管理
 *
 * - 共享一个 Redis 连接（maxRetriesPerRequest: null 为 BullMQ 必需）
 * - getQueue(name) 懒创建并缓存 Queue 实例
 * - 默认重试策略：指数退避，最多 3 次
 */
@Injectable()
export class QueueService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(QueueService.name);
  private connection: Redis;
  private readonly queues = new Map<string, Queue>();

  async onModuleInit() {
    this.connection = new Redis({
      host: process.env.REDIS_HOST ?? 'localhost',
      port: parseInt(process.env.REDIS_PORT ?? '6379', 10),
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
    });
    this.logger.log('BullMQ connection ready');
  }

  async onModuleDestroy() {
    await Promise.all([...this.queues.values()].map((q) => q.close()));
    await this.connection?.quit();
  }

  getQueue(name: QueueName): Queue {
    let queue = this.queues.get(name);
    if (!queue) {
      queue = new Queue(name, {
        connection: this.connection,
        defaultJobOptions: {
          attempts: 3,
          backoff: { type: 'exponential', delay: 2000 },
          removeOnComplete: 100,
          removeOnFail: 500,
        },
      });
      this.queues.set(name, queue);
      this.logger.log(`Queue "${name}" created (concurrency=${QUEUE_CONCURRENCY[name]})`);
    }
    return queue;
  }

  /** 入队辅助 */
  async add(name: QueueName, jobName: string, data: unknown) {
    return this.getQueue(name).add(jobName, data);
  }
}
```

`queue.module.ts`（整体替换占位实现）：

```typescript
import { Global, Module } from '@nestjs/common';
import { QueueService } from './queue.service';

@Global()
@Module({
  providers: [QueueService],
  exports: [QueueService],
})
export class QueueModule {}
```

- [ ] **Step 5: 运行测试确认通过**

Run: `cd apps/api && npx jest src/infrastructure/queue/queue.service.spec.ts --no-cache`
Expected: PASS。

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/infrastructure/queue
git commit -m "feat: BullMQ 独立队列基础设施"
```

---

## Task 5: 统一模型提供文件 + 解析服务

**Files:**
- Create: `apps/api/src/modules/model-provider/model-provider.ts`
- Create: `apps/api/src/modules/model-provider/model-provider.service.ts`
- Create: `apps/api/src/modules/model-provider/model-provider.module.ts`
- Test: `apps/api/src/modules/model-provider/model-provider.service.spec.ts`

- [ ] **Step 1: 写统一模型提供文件**

`model-provider.ts`（★ 全项目 embedding 模型选择的唯一入口）：

```typescript
/**
 * ★ 统一模型提供文件
 *
 * 集中管理 Embedding 模型 → Provider 的注册表与解析规则。
 * 任何模块（Worker 索引 / 客户提问 Embedding / 检索）都通过
 * ModelProviderService 获取模型配置，禁止各自硬编码模型名。
 */
export type EmbeddingProviderName = 'ollama' | 'openai';

export interface EmbeddingModelConfig {
  model: string;
  provider: EmbeddingProviderName;
  dimension: number;
  baseUrl: string;
  apiKey?: string;
}

/** 内置已知模型注册表（可扩展，DB models 表为 V2 增强） */
const KNOWN_MODELS: Record<string, { provider: EmbeddingProviderName; dimension: number }> = {
  'bge-m3': { provider: 'ollama', dimension: 1024 },
  'nomic-embed-text': { provider: 'ollama', dimension: 768 },
  'text-embedding-3-small': { provider: 'openai', dimension: 1536 },
};

export function parseModelName(model: string): {
  provider?: EmbeddingProviderName;
  name: string;
} {
  if (model.includes('/')) {
    const [provider, name] = model.split('/');
    return { provider: provider as EmbeddingProviderName, name };
  }
  return { name: model };
}

export function resolveKnownModel(name: string): { provider: EmbeddingProviderName; dimension: number } | undefined {
  return KNOWN_MODELS[name];
}
```

- [ ] **Step 2: 写失败测试**

```typescript
import { ModelProviderService } from './model-provider.service';

describe('ModelProviderService', () => {
  let service: ModelProviderService;

  beforeEach(() => {
    service = new ModelProviderService();
  });

  it('已知模型名解析出 provider 与 dimension', () => {
    const cfg = service.resolveEmbeddingConfig('bge-m3');
    expect(cfg.provider).toBe('ollama');
    expect(cfg.dimension).toBe(1024);
  });

  it('支持 provider/model 显式格式', () => {
    const cfg = service.resolveEmbeddingConfig('openai/text-embedding-3-small');
    expect(cfg.provider).toBe('openai');
    expect(cfg.dimension).toBe(1536);
  });

  it('未知模型回退到 provider=ollama 且 dimension 用默认', () => {
    const cfg = service.resolveEmbeddingConfig('my-custom-model');
    expect(cfg.provider).toBe('ollama');
    expect(cfg.model).toBe('my-custom-model');
  });

  it('未传模型时使用环境默认', () => {
    const cfg = service.resolveEmbeddingConfig();
    expect(cfg.model).toBe('bge-m3');
  });
});
```

- [ ] **Step 3: 运行测试确认失败**

Run: `cd apps/api && npx jest src/modules/model-provider/model-provider.service.spec.ts --no-cache`
Expected: FAIL —— `Cannot find module`.

- [ ] **Step 4: 实现解析服务与模块**

`model-provider.service.ts`：

```typescript
import { Injectable } from '@nestjs/common';
import {
  EmbeddingModelConfig,
  parseModelName,
  resolveKnownModel,
} from './model-provider';

/**
 * 模型提供解析服务
 *
 * 解析优先级：传入 modelName（KB.embedding_model）→ 环境默认
 * provider baseUrl/apiKey 从环境变量读取。
 */
@Injectable()
export class ModelProviderService {
  resolveEmbeddingConfig(modelName?: string): EmbeddingModelConfig {
    const effectiveModel = modelName?.trim() || process.env.EMBEDDING_DEFAULT_MODEL || 'bge-m3';
    const { provider: providerHint, name } = parseModelName(effectiveModel);
    const known = resolveKnownModel(name);

    const provider = providerHint ?? known?.provider ?? (process.env.EMBEDDING_DEFAULT_PROVIDER as 'ollama' | 'openai') ?? 'ollama';
    const dimension = known?.dimension ?? parseInt(process.env.EMBEDDING_DIMENSION || '1024', 10);

    const baseUrl =
      provider === 'openai'
        ? process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1'
        : process.env.OLLAMA_BASE_URL || 'http://localhost:11434';

    return {
      model: name,
      provider,
      dimension,
      baseUrl,
      apiKey: provider === 'openai' ? process.env.OPENAI_API_KEY : undefined,
    };
  }
}
```

`model-provider.module.ts`：

```typescript
import { Global, Module } from '@nestjs/common';
import { ModelProviderService } from './model-provider.service';

@Global()
@Module({
  providers: [ModelProviderService],
  exports: [ModelProviderService],
})
export class ModelProviderModule {}
```

- [ ] **Step 5: 运行测试确认通过**

Run: `cd apps/api && npx jest src/modules/model-provider/model-provider.service.spec.ts --no-cache`
Expected: PASS（环境变量需先设 `EMBEDDING_DEFAULT_MODEL=bge-m3`，或测试内 `process.env` 兜底为 bge-m3 —— 实现已含默认值）。

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/modules/model-provider
git commit -m "feat: 统一 embedding 模型提供文件与解析服务"
```

---

## Task 6: Embedding Providers（策略模式）

**Files:**
- Modify: `apps/api/src/modules/embedding/providers/embedding-provider.interface.ts`（填充空文件）
- Modify: `apps/api/src/modules/embedding/providers/ollama-embedding.provider.ts`（填充空文件）
- Create: `apps/api/src/modules/embedding/providers/openai-embedding.provider.ts`
- Test: `apps/api/src/modules/embedding/providers/ollama-embedding.provider.spec.ts`

- [ ] **Step 1: 定义 Provider 接口**

`embedding-provider.interface.ts`：

```typescript
/** Embedding Provider 统一接口 */
export interface EmbeddingProvider {
  readonly model: string;
  readonly dimension: number;
  /** 批量向量化，输入输出顺序一一对应 */
  embed(texts: string[]): Promise<number[][]>;
}
```

- [ ] **Step 2: 写失败测试（Ollama）**

```typescript
import { OllamaEmbeddingProvider } from './ollama-embedding.provider';

describe('OllamaEmbeddingProvider', () => {
  it('调用 /api/embed 并返回 embeddings 数组', async () => {
    const mockFetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ embeddings: [[0.1, 0.2], [0.3, 0.4]] }),
    });
    global.fetch = mockFetch as never;

    const provider = new OllamaEmbeddingProvider({
      baseUrl: 'http://ollama:11434',
      model: 'bge-m3',
      dimension: 2,
    });

    const vectors = await provider.embed(['a', 'b']);
    expect(vectors).toEqual([[0.1, 0.2], [0.3, 0.4]]);
    expect(mockFetch).toHaveBeenCalledWith(
      'http://ollama:11434/api/embed',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ model: 'bge-m3', input: ['a', 'b'] }),
      }),
    );
  });

  it('非 2xx 响应抛出异常', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 500 }) as never;
    const provider = new OllamaEmbeddingProvider({ baseUrl: 'http://x', model: 'm', dimension: 2 });
    await expect(provider.embed(['a'])).rejects.toThrow('500');
  });
});
```

- [ ] **Step 3: 运行测试确认失败**

Run: `cd apps/api && npx jest src/modules/embedding/providers/ollama-embedding.provider.spec.ts --no-cache`
Expected: FAIL —— 实现缺失。

- [ ] **Step 4: 实现 Ollama Provider**

`ollama-embedding.provider.ts`：

```typescript
import { EmbeddingProvider } from './embedding-provider.interface';

export interface OllamaEmbeddingConfig {
  baseUrl: string;
  model: string;
  dimension: number;
}

/**
 * Ollama 本地 Embedding Provider
 * POST /api/embed → { embeddings: number[][] }
 */
export class OllamaEmbeddingProvider implements EmbeddingProvider {
  readonly model: string;
  readonly dimension: number;
  private readonly baseUrl: string;

  constructor(config: OllamaEmbeddingConfig) {
    this.model = config.model;
    this.dimension = config.dimension;
    this.baseUrl = config.baseUrl.replace(/\/$/, '');
  }

  async embed(texts: string[]): Promise<number[][]> {
    const res = await fetch(`${this.baseUrl}/api/embed`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: this.model, input: texts }),
    });
    if (!res.ok) {
      throw new Error(`Ollama embed failed: HTTP ${res.status}`);
    }
    const data = (await res.json()) as { embeddings: number[][] };
    return data.embeddings;
  }
}
```

- [ ] **Step 5: 实现 OpenAI 兼容 Provider**

`openai-embedding.provider.ts`：

```typescript
import { EmbeddingProvider } from './embedding-provider.interface';

export interface OpenAiEmbeddingConfig {
  baseUrl: string;
  apiKey: string;
  model: string;
  dimension: number;
}

/**
 * OpenAI 兼容 Embedding Provider（OpenAI / DashScope / 各类中转）
 * POST {baseUrl}/embeddings → { data: [{ embedding }] }
 */
export class OpenAiEmbeddingProvider implements EmbeddingProvider {
  readonly model: string;
  readonly dimension: number;
  private readonly baseUrl: string;
  private readonly apiKey: string;

  constructor(config: OpenAiEmbeddingConfig) {
    this.model = config.model;
    this.dimension = config.dimension;
    this.baseUrl = config.baseUrl.replace(/\/+$/, '');
    this.apiKey = config.apiKey;
  }

  async embed(texts: string[]): Promise<number[][]> {
    const res = await fetch(`${this.baseUrl}/embeddings`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({ model: this.model, input: texts }),
    });
    if (!res.ok) {
      throw new Error(`OpenAI embed failed: HTTP ${res.status}`);
    }
    const data = (await res.json()) as { data: Array<{ embedding: number[] }> };
    return data.data.map((d) => d.embedding);
  }
}
```

- [ ] **Step 6: 运行测试确认通过**

Run: `cd apps/api && npx jest src/modules/embedding/providers/ollama-embedding.provider.spec.ts --no-cache`
Expected: PASS。

- [ ] **Step 7: Commit**

```bash
git add apps/api/src/modules/embedding/providers
git commit -m "feat: Embedding Provider 策略（Ollama + OpenAI 兼容）"
```

---

## Task 7: EmbeddingService（批量向量化 + 客户提问缓存）

**Files:**
- Modify: `apps/api/src/modules/embedding/embedding.service.ts`（重写空文件）
- Modify: `apps/api/src/modules/embedding/embedding.module.ts`
- Create: `apps/api/src/worker/pipelines/embedders/batch-embedder.ts`
- Create: `apps/api/src/worker/pipelines/embedders/embedder.interface.ts`
- Test: `apps/api/src/modules/embedding/embedding.service.spec.ts`

- [ ] **Step 1: 写失败测试（核心：embedQuery 缓存流程 = 功能6）**

```typescript
import { Test } from '@nestjs/testing';
import { EmbeddingService } from './embedding.service';
import { ModelProviderService } from '../model-provider/model-provider.service';

describe('EmbeddingService', () => {
  let service: EmbeddingService;
  let provider: ModelProviderService;
  const redisMock = {
    get: jest.fn(),
    set: jest.fn(),
  };

  beforeEach(async () => {
    provider = {
      resolveEmbeddingConfig: jest.fn().mockReturnValue({
        model: 'bge-m3',
        provider: 'ollama',
        dimension: 3,
        baseUrl: 'http://ollama:11434',
      }),
    } as never;

    const moduleRef = await Test.createTestingModule({
      providers: [
        EmbeddingService,
        { provide: ModelProviderService, useValue: provider },
        { provide: 'REDIS_SERVICE', useValue: redisMock },
      ],
    })
      .overrideProvider('REDIS_SERVICE')
      .useValue(redisMock)
      .compile();

    service = moduleRef.get(EmbeddingService);
    // 注入 redis 后直接替换其依赖引用
    (service as unknown as { redis: unknown }).redis = redisMock;
    jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ embeddings: [[1, 2, 3]] }),
    } as never);
  });

  afterEach(() => jest.restoreAllMocks());

  it('embedQuery 缓存未命中时调用 provider 并写入 24h 缓存', async () => {
    redisMock.get.mockResolvedValue(null);
    const result = await service.embedQuery('请假流程是什么?');
    expect(result.vector).toEqual([1, 2, 3]);
    expect(result.cached).toBe(false);
    expect(result.model).toBe('bge-m3');
    expect(redisMock.set).toHaveBeenCalledWith(expect.stringMatching(/^embed:[0-9a-f]{64}:bge-m3$/), '[1,2,3]', 86400);
  });

  it('embedQuery 缓存命中时直接返回缓存向量，不调用 provider', async () => {
    redisMock.get.mockResolvedValue('[9,9,9]');
    const result = await service.embedQuery('请假流程是什么?');
    expect(result.vector).toEqual([9, 9, 9]);
    expect(result.cached).toBe(true);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('embedChunks 批量向量化并返回向量数组', async () => {
    const vectors = await service.embedChunks(['text1', 'text2']);
    expect(vectors).toHaveLength(1); // mock 只返回一条
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `cd apps/api && npx jest src/modules/embedding/embedding.service.spec.ts --no-cache`
Expected: FAIL —— `EmbeddingService` 为空实现。

- [ ] **Step 3: 实现 BatchEmbedder**

`embedders/embedder.interface.ts`：

```typescript
/** 批量向量化接口（Pipeline 与 Service 共用） */
export interface BatchEmbedder {
  embed(texts: string[]): Promise<number[][]>;
}
```

`embedders/batch-embedder.ts`：

```typescript
import { EmbeddingProvider } from '../../../modules/embedding/providers/embedding-provider.interface';

/**
 * 批量向量化器 —— 控制 Provider 的批大小与并发
 * 每批 BATCH_SIZE 条，串行调用 provider（避免触发 rate limit）
 */
export class BatchEmbedder {
  private static readonly BATCH_SIZE = 32;

  constructor(private readonly provider: EmbeddingProvider) {}

  async embed(texts: string[]): Promise<number[][]> {
    const results: number[][] = [];
    for (let i = 0; i < texts.length; i += BatchEmbedder.BATCH_SIZE) {
      const batch = texts.slice(i, i + BatchEmbedder.BATCH_SIZE);
      const vectors = await this.provider.embed(batch);
      results.push(...vectors);
    }
    return results;
  }
}
```

- [ ] **Step 4: 实现 EmbeddingService**

`embedding.service.ts`（整体替换）：

```typescript
import { Injectable, Logger } from '@nestjs/common';
import { createHash } from 'crypto';
import { ModelProviderService } from '../model-provider/model-provider.service';
import { RedisService } from '../../infrastructure/redis/redis.service';
import { OllamaEmbeddingProvider } from './providers/ollama-embedding.provider';
import { OpenAiEmbeddingProvider } from './providers/openai-embedding.provider';
import { BatchEmbedder } from '../../worker/pipelines/embedders/batch-embedder';

export interface QueryEmbedResult {
  vector: number[];
  model: string;
  dimension: number;
  cached: boolean;
}

/** Embedding 缓存 TTL：24h（设计文档 2bis.3） */
const EMBEDDING_CACHE_TTL = 60 * 60 * 24;

@Injectable()
export class EmbeddingService {
  private readonly logger = new Logger(EmbeddingService.name);

  constructor(
    private readonly modelProvider: ModelProviderService,
    private readonly redis: RedisService,
  ) {}

  private buildProvider(modelName?: string) {
    const config = this.modelProvider.resolveEmbeddingConfig(modelName);
    const provider =
      config.provider === 'openai'
        ? new OpenAiEmbeddingProvider({
            baseUrl: config.baseUrl,
            apiKey: config.apiKey ?? '',
            model: config.model,
            dimension: config.dimension,
          })
        : new OllamaEmbeddingProvider({
            baseUrl: config.baseUrl,
            model: config.model,
            dimension: config.dimension,
          });
    return { config, provider };
  }

  /**
   * 批量向量化（文档 chunks 索引用）
   */
  async embedChunks(texts: string[], modelName?: string): Promise<number[][]> {
    const { config, provider } = this.buildProvider(modelName);
    return new BatchEmbedder(provider).embed(texts);
  }

  /**
   * ★ 客户提问 Embedding + 缓存流程（功能6）
   *
   * 1. hash = SHA256(query)
   * 2. key = embed:{hash}:{model_name}
   * 3. Redis GET → HIT 直接返回；MISS → 调 provider → SETEX 24h
   */
  async embedQuery(query: string, opts?: { modelName?: string }): Promise<QueryEmbedResult> {
    const { config, provider } = this.buildProvider(opts?.modelName);
    const hash = createHash('sha256').update(query).digest('hex');
    const key = `embed:${hash}:${config.model}`;

    const cached = await this.redis.get(key);
    if (cached) {
      return {
        vector: JSON.parse(cached) as number[],
        model: config.model,
        dimension: config.dimension,
        cached: true,
      };
    }

    const [vector] = await provider.embed([query]);
    await this.redis.set(key, JSON.stringify(vector), EMBEDDING_CACHE_TTL);
    return {
      vector,
      model: config.model,
      dimension: config.dimension,
      cached: false,
    };
  }
}
```

`embedding.module.ts`（整体替换）：

```typescript
import { Global, Module } from '@nestjs/common';
import { EmbeddingService } from './embedding.service';

@Global()
@Module({
  providers: [EmbeddingService],
  exports: [EmbeddingService],
})
export class EmbeddingModule {}
```

- [ ] **Step 5: 运行测试确认通过**

Run: `cd apps/api && npx jest src/modules/embedding/embedding.service.spec.ts --no-cache`
Expected: PASS。若 `RedisService` 注入失败，改为测试内 `new EmbeddingService(provider, redisMock)` 直构（参考下方注记）。

> 注：测试内若不便用 `Test.createTestingModule` 解析全局 `RedisService`，直接 `new EmbeddingService(provider as never, redisMock as never)` 并 mock `global.fetch` 即可。

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/modules/embedding apps/api/src/worker/pipelines/embedders
git commit -m "feat: EmbeddingService 批量向量化与查询缓存流程"
```

---

## Task 8: Loaders（策略模式）

**Files:**
- Modify: `apps/api/src/worker/pipelines/loaders/loader.interface.ts`（填充空文件）
- Modify: `apps/api/src/worker/pipelines/loaders/pdf-loader.ts`（填充空文件）
- Create: `apps/api/src/worker/pipelines/loaders/markdown-loader.ts`
- Create: `apps/api/src/worker/pipelines/loaders/text-loader.ts`
- Test: `apps/api/src/worker/pipelines/loaders/pdf-loader.spec.ts`

- [ ] **Step 1: 定义 Loader 接口**

`loader.interface.ts`：

```typescript
/** 一页/一段已抽取文本 */
export interface LoadedPage {
  pageNumber: number;
  content: string;
  metadata?: Record<string, unknown>;
}

/**
 * Loader 策略接口 —— 新增格式只需注册新 Loader，无需改 Pipeline
 */
export interface Loader {
  supports(mimeType: string, fileName?: string): boolean;
  load(buffer: Buffer, mimeType: string, fileName?: string): Promise<LoadedPage[]>;
}
```

- [ ] **Step 2: 写失败测试（PDF + 文本）**

```typescript
import { PdfLoader } from './pdf-loader';
import { TextLoader } from './text-loader';

jest.mock('pdf-parse', () => {
  const parse = jest.fn().mockResolvedValue({ text: 'page one\n\fpage two', numpages: 2 });
  (parse as unknown as { test: () => boolean }).test = () => true;
  return parse;
});

describe('PdfLoader', () => {
  it('supports 识别 pdf', () => {
    const loader = new PdfLoader();
    expect(loader.supports('application/pdf', 'a.pdf')).toBe(true);
    expect(loader.supports('text/plain', 'a.txt')).toBe(false);
  });

  it('load 按分页符拆分为多页', async () => {
    const loader = new PdfLoader();
    const pages = await loader.load(Buffer.from('x'), 'application/pdf', 'a.pdf');
    expect(pages).toHaveLength(2);
    expect(pages[0].pageNumber).toBe(1);
    expect(pages[0].content).toBe('page one');
  });
});

describe('TextLoader', () => {
  it('load 返回 utf-8 单页文本', async () => {
    const loader = new TextLoader();
    const pages = await loader.load(Buffer.from('你好', 'utf-8'), 'text/plain', 'a.txt');
    expect(pages).toEqual([{ pageNumber: 1, content: '你好' }]);
  });
});
```

- [ ] **Step 3: 运行测试确认失败**

Run: `cd apps/api && npx jest src/worker/pipelines/loaders --no-cache`
Expected: FAIL —— 空实现。

- [ ] **Step 4: 实现 PDF / Text / Markdown Loader**

`pdf-loader.ts`：

```typescript
import { Loader, LoadedPage } from './loader.interface';

const PDF_MIME = 'application/pdf';

/** PDF Loader —— 基于 pdf-parse，按 \f 分页符拆页 */
export class PdfLoader implements Loader {
  supports(mimeType: string, fileName?: string): boolean {
    return mimeType === PDF_MIME || (fileName ?? '').toLowerCase().endsWith('.pdf');
  }

  async load(buffer: Buffer): Promise<LoadedPage[]> {
    // 延迟 require 以隔离 pdf-parse 依赖
    const pdfParse = (await import('pdf-parse')) as (
      data: Buffer,
    ) => Promise<{ text: string }>;
    const { text } = await pdfParse(buffer);
    const rawPages = text.split('\f').map((s) => s.trim()).filter((s) => s.length > 0);
    const pages = rawPages.length > 0 ? rawPages : [text.trim()];
    return pages.map((content, i) => ({
      pageNumber: i + 1,
      content,
      metadata: { source: 'pdf' },
    }));
  }
}
```

> 注：jest 的 module mock 与 `import('pdf-parse')` 动态导入存在差异；如测试解析失败，把 `pdfParse` 改为顶层 `import pdfParse from 'pdf-parse'`（类型缺失时在 `src/types/pdf-parse.d.ts` 声明 `declare module 'pdf-parse'`）。

`text-loader.ts`：

```typescript
import { Loader, LoadedPage } from './loader.interface';

const TEXT_MIME = ['text/plain', 'text/markdown', 'text/x-markdown'];

/** 纯文本 Loader（txt / md / 其他纯文本兜底） */
export class TextLoader implements Loader {
  supports(mimeType: string, fileName?: string): boolean {
    const ext = (fileName ?? '').toLowerCase();
    return TEXT_MIME.includes(mimeType) || ext.endsWith('.txt') || ext.endsWith('.md');
  }

  async load(buffer: Buffer): Promise<LoadedPage[]> {
    return [{ pageNumber: 1, content: buffer.toString('utf-8') }];
  }
}
```

`markdown-loader.ts`：

```typescript
import { Loader, LoadedPage } from './loader.interface';

/**
 * Markdown Loader —— 按二级标题(#/##)切分为语义段落
 * 作为 TextLoader 的增强，先于 TextLoader 匹配
 */
export class MarkdownLoader implements Loader {
  supports(mimeType: string, fileName?: string): boolean {
    return mimeType.includes('markdown') || (fileName ?? '').toLowerCase().endsWith('.md');
  }

  async load(buffer: Buffer): Promise<LoadedPage[]> {
    const raw = buffer.toString('utf-8');
    const sections = raw.split(/(?=^#{1,2} )/m).filter((s) => s.trim().length > 0);
    const chunks = sections.length > 0 ? sections : [raw];
    return chunks.map((content, i) => ({
      pageNumber: i + 1,
      content,
      metadata: { source: 'markdown' },
    }));
  }
}
```

- [ ] **Step 5: 运行测试确认通过**

Run: `cd apps/api && npx jest src/worker/pipelines/loaders --no-cache`
Expected: PASS。

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/worker/pipelines/loaders
git commit -m "feat: 多格式 Loader 策略（PDF/Text/Markdown）"
```

---

## Task 9: 文本分割器（TextSplitter）

**Files:**
- Create: `apps/api/src/worker/pipelines/splitters/splitter.interface.ts`
- Create: `apps/api/src/worker/pipelines/splitters/text-splitter.ts`
- Test: `apps/api/src/worker/pipelines/splitters/text-splitter.spec.ts`

- [ ] **Step 1: 定义接口**

`splitter.interface.ts`：

```typescript
/** 分割后的 chunk */
export interface SplitChunk {
  page: number;
  chunkIndex: number;
  content: string;
  contentHash: string;
  tokenCount: number;
  metadata?: Record<string, unknown>;
}

export interface SplitOptions {
  chunkSize?: number; // 字符数上限（近似 token）
  chunkOverlap?: number;
}

export interface TextSplitterPort {
  split(pages: Array<{ pageNumber: number; content: string; metadata?: Record<string, unknown> }>, opts?: SplitOptions): SplitChunk[];
}
```

- [ ] **Step 2: 写失败测试**

```typescript
import { TextSplitter } from './text-splitter';
import { createHash } from 'crypto';

describe('TextSplitter', () => {
  it('超过 chunkSize 的文本按大小切分', () => {
    const splitter = new TextSplitter();
    const chunks = splitter.split(
      [{ pageNumber: 1, content: 'a'.repeat(500) }],
      { chunkSize: 100, chunkOverlap: 0 },
    );
    expect(chunks).toHaveLength(5);
    expect(chunks[0].page).toBe(1);
    expect(chunks[0].chunkIndex).toBe(0);
  });

  it('chunkOverlap 使相邻 chunk 有重叠', () => {
    const splitter = new TextSplitter();
    const chunks = splitter.split(
      [{ pageNumber: 1, content: 'b'.repeat(300) }],
      { chunkSize: 100, chunkOverlap: 20 },
    );
    expect(chunks[1].content).toContain('b'.repeat(20));
  });

  it('contentHash 为内容 sha256 前缀', () => {
    const splitter = new TextSplitter();
    const chunks = splitter.split([{ pageNumber: 1, content: 'hello' }], { chunkSize: 100 });
    expect(chunks[0].contentHash).toBe(createHash('sha256').update('hello').digest('hex'));
  });
});
```

- [ ] **Step 3: 运行测试确认失败**

Run: `cd apps/api && npx jest src/worker/pipelines/splitters --no-cache`
Expected: FAIL —— 缺失实现。

- [ ] **Step 4: 实现 TextSplitter**

`text-splitter.ts`：

```typescript
import { createHash } from 'crypto';
import { SplitChunk, SplitOptions, TextSplitterPort } from './splitter.interface';

/**
 * 文本分割器 —— 字符级近似切分
 * 默认 chunkSize=800 字符（约 200-400 token），overlap=80
 */
export class TextSplitter implements TextSplitterPort {
  private readonly defaultChunkSize = 800;
  private readonly defaultOverlap = 80;

  split(
    pages: Array<{ pageNumber: number; content: string; metadata?: Record<string, unknown> }>,
    opts?: SplitOptions,
  ): SplitChunk[] {
    const chunkSize = opts?.chunkSize ?? this.defaultChunkSize;
    const overlap = opts?.chunkOverlap ?? this.defaultOverlap;

    const chunks: SplitChunk[] = [];
    let index = 0;

    for (const page of pages) {
      const text = page.content.replace(/\s+/g, ' ').trim();
      if (!text) continue;

      for (let start = 0; start < text.length; start += chunkSize - overlap) {
        const content = text.slice(start, start + chunkSize).trim();
        if (!content) continue;
        chunks.push({
          page: page.pageNumber,
          chunkIndex: index++,
          content,
          contentHash: createHash('sha256').update(content).digest('hex'),
          tokenCount: Math.ceil(content.length / 4),
          metadata: { ...page.metadata },
        });
      }
    }
    return chunks;
  }
}
```

- [ ] **Step 5: 运行测试确认通过**

Run: `cd apps/api && npx jest src/worker/pipelines/splitters --no-cache`
Expected: PASS。

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/worker/pipelines/splitters
git commit -m "feat: TextSplitter 文本分割器"
```

---

## Task 10: 文本解析器（Parser）

**Files:**
- Create: `apps/api/src/worker/pipelines/parsers/parser.interface.ts`
- Create: `apps/api/src/worker/pipelines/parsers/text-parser.ts`
- Test: `apps/api/src/worker/pipelines/parsers/text-parser.spec.ts`

- [ ] **Step 1: 定义接口**

`parser.interface.ts`：

```typescript
import { LoadedPage } from '../loaders/loader.interface';

/** 解析结果：结构化文本 + 元数据 */
export interface ParsedDocument {
  pages: Array<{ pageNumber: number; content: string; metadata?: Record<string, unknown> }>;
  totalPages: number;
  summary?: string;
}

export interface DocumentParser {
  parse(pages: LoadedPage[]): Promise<ParsedDocument>;
}
```

- [ ] **Step 2: 写失败测试**

```typescript
import { TextParser } from './text-parser';

describe('TextParser', () => {
  it('清洗空白并统计总页数', async () => {
    const parser = new TextParser();
    const result = await parser.parse([
      { pageNumber: 1, content: '  hello   world  ' },
      { pageNumber: 2, content: '\nsecond\n' },
    ]);
    expect(result.totalPages).toBe(2);
    expect(result.pages[0].content).toBe('hello world');
    expect(result.pages[1].content).toBe('second');
  });
});
```

- [ ] **Step 3: 运行测试确认失败**

Run: `cd apps/api && npx jest src/worker/pipelines/parsers --no-cache`
Expected: FAIL。

- [ ] **Step 4: 实现 TextParser**

`text-parser.ts`：

```typescript
import { LoadedPage } from '../loaders/loader.interface';
import { DocumentParser, ParsedDocument } from './parser.interface';

/**
 * 文本解析器 —— 空白归一化、去空页、生成摘要
 */
export class TextParser implements DocumentParser {
  async parse(pages: LoadedPage[]): Promise<ParsedDocument> {
    const cleaned = pages
      .map((p) => ({
        pageNumber: p.pageNumber,
        content: p.content.replace(/\s+/g, ' ').trim(),
        metadata: p.metadata,
      }))
      .filter((p) => p.content.length > 0);

    const total = cleaned.reduce((sum, p) => sum + p.content.length, 0);
    return {
      pages: cleaned,
      totalPages: cleaned.length,
      summary: total > 0 ? `共 ${cleaned.length} 页，${total} 字符` : undefined,
    };
  }
}
```

- [ ] **Step 5: 运行测试确认通过**

Run: `cd apps/api && npx jest src/worker/pipelines/parsers --no-cache`
Expected: PASS。

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/worker/pipelines/parsers
git commit -m "feat: 文本解析器"
```

---

## Task 11: 持久化服务（Chunks + Embeddings）

**Files:**
- Create: `apps/api/src/worker/pipelines/persist/persist.service.ts`
- Create: `apps/api/src/worker/pipelines/persist/batch-writer.ts`
- Test: `apps/api/src/worker/pipelines/persist/persist.service.spec.ts`

- [ ] **Step 1: 写失败测试**

```typescript
import { PersistService } from './persist.service';
import { SplitChunk } from '../splitters/splitter.interface';

describe('PersistService', () => {
  const prismaMock = {
    documentChunk: { createMany: jest.fn(), deleteMany: jest.fn() },
    $executeRaw: jest.fn(),
  };

  it('saveChunks 调用 createMany 批量写入', async () => {
    prismaMock.documentChunk.createMany.mockResolvedValue({ count: 2 });
    const service = new PersistService(prismaMock as never);
    const chunks: SplitChunk[] = [
      { page: 1, chunkIndex: 0, content: 'a', contentHash: 'h1', tokenCount: 1 },
      { page: 1, chunkIndex: 1, content: 'b', contentHash: 'h2', tokenCount: 1 },
    ];
    const result = await service.saveChunks('v1', chunks);
    expect(result.count).toBe(2);
    expect(prismaMock.documentChunk.createMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.any(Array) }),
    );
  });

  it('saveEmbedding 使用原生 SQL 写入 vector', async () => {
    prismaMock.$executeRaw.mockResolvedValue(1);
    const service = new PersistService(prismaMock as never);
    await service.saveEmbedding('chunk1', 'kb1', 'bge-m3', [0.1, 0.2]);
    expect(prismaMock.$executeRaw).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `cd apps/api && npx jest src/worker/pipelines/persist --no-cache`
Expected: FAIL。

- [ ] **Step 3: 实现 BatchWriter 与 PersistService**

`batch-writer.ts`：

```typescript
import { SplitChunk } from '../splitters/splitter.interface';

/** 将 SplitChunk 转为 Prisma createMany data */
export function toChunkRows(versionId: string, chunks: SplitChunk[]) {
  return chunks.map((c) => ({
    versionId,
    page: c.page,
    chunkIndex: c.chunkIndex,
    content: c.content,
    contentHash: c.contentHash,
    tokenCount: c.tokenCount,
    metadata: (c.metadata ?? {}) as object,
  }));
}
```

`persist.service.ts`：

```typescript
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database/prisma/prisma.service';
import { SplitChunk } from '../splitters/splitter.interface';
import { toChunkRows } from './batch-writer';

/**
 * 持久化服务 —— 落库 document_chunks 与 chunk_embeddings
 */
@Injectable()
export class PersistService {
  constructor(private readonly prisma: PrismaService) {}

  /** 批量写入 chunks */
  async saveChunks(versionId: string, chunks: SplitChunk[]) {
    if (chunks.length === 0) return { count: 0, ids: [] as string[] };
    const rows = toChunkRows(versionId, chunks);
    const created = await this.prisma.documentChunk.createMany({ data: rows });
    // 回查刚写入的 id（createMany 不返回 id，按 versionId + chunkIndex 定位）
    const saved = await this.prisma.documentChunk.findMany({
      where: { versionId },
      select: { id: true },
      orderBy: { chunkIndex: 'asc' },
    });
    return { count: created.count, ids: saved.map((s) => s.id) };
  }

  /**
   * 写入单条向量（原生 SQL，vector 类型 Prisma 不支持）
   * ON CONFLICT (chunk_id, model_name) DO NOTHING 幂等
   */
  async saveEmbedding(chunkId: string, kbId: string, modelName: string, vector: number[]) {
    await this.prisma.$executeRaw`
      INSERT INTO chunk_embeddings (chunk_id, model_name, kb_id, embedding)
      VALUES (${chunkId}::uuid, ${modelName}::varchar, ${kbId}::uuid, ${JSON.stringify(vector)}::vector)
      ON CONFLICT (chunk_id, model_name) DO NOTHING
    `;
  }

  /** 批量写入向量 */
  async saveEmbeddings(
    rows: Array<{ chunkId: string; kbId: string; modelName: string; vector: number[] }>,
  ) {
    for (const row of rows) {
      await this.saveEmbedding(row.chunkId, row.kbId, row.modelName, row.vector);
    }
  }

  /** 删除某版本全部 chunks（级联删向量） */
  async deleteChunksByVersion(versionId: string) {
    return this.prisma.documentChunk.deleteMany({ where: { versionId } });
  }

  /** 删除文档全部 chunks（级联删向量） */
  async deleteChunksByDocument(documentId: string) {
    return this.prisma.documentChunk.deleteMany({
      where: { version: { documentId } },
    });
  }
}
```

- [ ] **Step 4: 运行测试确认通过**

Run: `cd apps/api && npx jest src/worker/pipelines/persist --no-cache`
Expected: PASS。

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/worker/pipelines/persist
git commit -m "feat: Chunks 与 Embedding 向量持久化服务"
```

---

## Task 12: Index Pipeline 编排

**Files:**
- Modify: `apps/api/src/worker/pipelines/index-pipeline.ts`（填充空文件）
- Test: `apps/api/src/worker/pipelines/index-pipeline.spec.ts`

- [ ] **Step 1: 写失败测试**

```typescript
import { IndexPipeline } from './index-pipeline';

describe('IndexPipeline', () => {
  const prismaMock = {
    document: { findUnique: jest.fn(), update: jest.fn() },
    knowledgeBase: { findUnique: jest.fn() },
    indexJob: { create: jest.fn(), update: jest.fn() },
    documentVersion: { update: jest.fn() },
  };
  const minioMock = { downloadObject: jest.fn() };
  const persistMock = { saveChunks: jest.fn(), saveEmbeddings: jest.fn() };
  const loaderMock = {
    supports: jest.fn(() => true),
    load: jest.fn(async () => [{ pageNumber: 1, content: 'hello worker' }]),
  };
  const splitterMock = { split: jest.fn(() => []) };
  const embedderMock = { embed: jest.fn(async () => []) };
  const queueMock = { add: jest.fn() };

  it('完整流水线执行并 enqueue embedding 任务', async () => {
    prismaMock.document.findUnique.mockResolvedValue({
      id: 'd1', kbId: 'kb1', status: 'UPLOADING',
    });
    prismaMock.knowledgeBase.findUnique.mockResolvedValue({ id: 'kb1', embeddingModel: 'bge-m3' });
    prismaMock.indexJob.create.mockResolvedValue({ id: 'job1' });
    prismaMock.document.update.mockResolvedValue({});
    prismaMock.documentVersion.update.mockResolvedValue({});
    minioMock.downloadObject.mockResolvedValue(Buffer.from('x'));
    persistMock.saveChunks.mockResolvedValue({ count: 1, ids: ['chunk1'] });

    const pipeline = new IndexPipeline(
      prismaMock as never, minioMock as never, persistMock as never,
      [loaderMock] as never, splitterMock as never, embedderMock as never,
      queueMock as never, { resolveEmbeddingConfig: () => ({ model: 'bge-m3', dimension: 1024, provider: 'ollama', baseUrl: 'x' }) } as never,
    );

    await pipeline.run('d1', 'v1', 'kb1');
    expect(queueMock.add).toHaveBeenCalledWith('embedding', expect.any(String), expect.objectContaining({ documentId: 'd1' }));
    expect(prismaMock.indexJob.update).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `cd apps/api && npx jest src/worker/pipelines/index-pipeline.spec.ts --no-cache`
Expected: FAIL。

- [ ] **Step 3: 实现 IndexPipeline**

`index-pipeline.ts`：

```typescript
import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database/prisma/prisma.service';
import { MinioService } from '../../../infrastructure/minio/minio.service';
import { PersistService } from './persist/persist.service';
import { Loader } from './loaders/loader.interface';
import { TextSplitterPort } from './splitters/splitter.interface';
import { TextParser, DocumentParser } from './parsers/parser.interface';
import { BatchEmbedder } from './embedders/batch-embedder';
import { QueueService } from '../../../infrastructure/queue/queue.service';
import { QUEUE_NAMES } from '../../../infrastructure/queue/queue.constants';
import { ModelProviderService } from '../../../modules/model-provider/model-provider.service';
import { OllamaEmbeddingProvider } from '../../../modules/embedding/providers/ollama-embedding.provider';
import { OpenAiEmbeddingProvider } from '../../../modules/embedding/providers/openai-embedding.provider';

export interface IndexRunResult {
  chunkIds: string[];
  chunkCount: number;
  jobId: string;
}

/**
 * Index Pipeline —— Loader → Parser → Splitter → Persist → Enqueue embedding
 * 对应设计文档 2.1 步骤 1-8（index Queue 内执行）
 */
@Injectable()
export class IndexPipeline {
  private readonly logger = new Logger(IndexPipeline.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly minio: MinioService,
    private readonly persist: PersistService,
    private readonly loaders: Loader[],
    private readonly splitter: TextSplitterPort,
    private readonly parser: DocumentParser,
    private readonly queueService: QueueService,
    private readonly modelProvider: ModelProviderService,
  ) {}

  async run(documentId: string, versionId: string, kbId: string, opts?: { reindex?: boolean }): Promise<IndexRunResult> {
    // 1. 文档 → PROCESSING
    await this.prisma.document.update({
      where: { id: documentId },
      data: { status: 'PROCESSING', errorMessage: null, updatedAt: new Date() },
    });

    // 2. 创建 index_job
    const job = await this.prisma.indexJob.create({
      data: {
        documentId,
        versionId,
        jobType: opts?.reindex ? 'REINDEX' : 'INDEX',
        status: 'RUNNING',
        progress: 0,
        totalSteps: 8,
        currentStep: 1,
        stepDescription: '开始索引',
        startedAt: new Date(),
      },
    });
    const updateJob = (step: number, progress: number, desc: string) =>
      this.prisma.indexJob.update({
        where: { id: job.id },
        data: { currentStep: step, progress, stepDescription: desc },
      });

    try {
      // 3. MinIO 下载
      const version = await this.prisma.documentVersion.findUnique({ where: { id: versionId } });
      if (!version) throw new Error(`version ${versionId} not found`);
      const buffer = await this.minio.downloadObject(version.fileUrl);
      await updateJob(2, 10, '下载文件完成');

      // 4. Loader 策略选择
      const loader = this.loaders.find((l) => l.supports(version.mimeType ?? '', version.fileUrl));
      if (!loader) throw new Error(`no loader for mimeType=${version.mimeType}`);
      const rawPages = await loader.load(buffer, version.mimeType ?? '', version.fileUrl);
      await updateJob(3, 20, `Loader: ${loader.constructor.name}`);

      // 5. Parser
      const parsed = await this.parser.parse(rawPages);
      await updateJob(4, 30, '解析完成');

      // 6. Splitter
      const chunks = this.splitter.split(parsed.pages);
      await updateJob(5, 50, `分割为 ${chunks.length} 个 chunk`);

      // 7. Persist chunks
      const { count, ids } = await this.persist.saveChunks(versionId, chunks);
      await this.prisma.documentVersion.update({
        where: { id: versionId },
        data: { chunkCount: count, status: 'PROCESSING' },
      });
      await updateJob(6, 60, `已落库 ${count} 个 chunk`);

      // 8. Enqueue → embedding Queue（★ 独立 Queue）
      const kb = await this.prisma.knowledgeBase.findUnique({ where: { id: kbId } });
      const modelName = kb?.embeddingModel || undefined;
      const { dimension } = this.modelProvider.resolveEmbeddingConfig(modelName);

      await this.queueService.add(
        QUEUE_NAMES.EMBEDDING,
        'embed-chunks',
        {
          documentId,
          versionId,
          kbId,
          chunkIds: ids,
          model: modelName,
          dimension,
          indexJobId: job.id,
        },
      );
      this.logger.log(`IndexPipeline done: doc=${documentId}, chunks=${count}, enqueued embedding`);
      return { chunkIds: ids, chunkCount: count, jobId: job.id };
    } catch (error) {
      await this.prisma.indexJob.update({
        where: { id: job.id },
        data: { status: 'FAILED', errorMessage: (error as Error).message },
      });
      await this.prisma.document.update({
        where: { id: documentId },
        data: { status: 'FAILED', errorMessage: (error as Error).message, updatedAt: new Date() },
      });
      throw error;
    }
  }
}
```

> 注：测试中 `IndexPipeline` 构造参数与上方接口对齐。`queueMock.add('embedding', ...)` 对应 `queueService.add(QUEUE_NAMES.EMBEDDING, 'embed-chunks', payload)`。

- [ ] **Step 4: 运行测试确认通过**

Run: `cd apps/api && npx jest src/worker/pipelines/index-pipeline.spec.ts --no-cache`
Expected: PASS。若 mock 与实际调用签名有出入，按测试断言修正（以测试为准）。

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/worker/pipelines/index-pipeline.ts apps/api/src/worker/pipelines/index-pipeline.spec.ts
git commit -m "feat: Index Pipeline 编排"
```

---

## Task 13: Consumers & Workers + 事件接线

**Files:**
- Modify: `apps/api/src/worker/consumers/index.consumer.ts`（填充空文件）
- Modify: `apps/api/src/worker/consumers/embedding.consumer.ts`（填充空文件）
- Create: `apps/api/src/worker/consumers/gc.consumer.ts`
- Create: `apps/api/src/worker/consumers/reindex.consumer.ts`
- Create: `apps/api/src/worker/pipelines/reindex-pipeline.ts`（填充空文件）
- Modify: `apps/api/src/modules/knowledge/document/document.service.ts`
- Modify: `apps/api/src/modules/knowledge/document/document.module.ts`
- Modify: `apps/api/src/modules/knowledge/document/document.controller.ts`
- Test: `apps/api/src/worker/consumers/index.consumer.spec.ts`

- [ ] **Step 1: 实现 IndexConsumer（功能1 监听 + 功能2 入队）**

`index.consumer.ts`：

```typescript
import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { Worker } from 'bullmq';
import { Redis } from 'ioredis';
import { QueueService } from '../../../infrastructure/queue/queue.service';
import { QUEUE_NAMES, QUEUE_CONCURRENCY } from '../../../infrastructure/queue/queue.constants';
import { DOCUMENT_UPLOADED, DocumentUploadedEvent } from '../../../infrastructure/event-bus/events/document-uploaded.event';
import { IndexPipeline } from '../pipelines/index-pipeline';

/**
 * Index 消费者
 * - @OnEvent('document.uploaded') → index Queue 入队
 * - BullMQ Worker 消费 index Queue（3 并发）→ IndexPipeline
 */
@Injectable()
export class IndexConsumer implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(IndexConsumer.name);
  private worker: Worker;

  constructor(
    private readonly queueService: QueueService,
    private readonly pipeline: IndexPipeline,
  ) {}

  @OnEvent(DOCUMENT_UPLOADED)
  async handleUploaded(payload: DocumentUploadedEvent) {
    await this.queueService.add(QUEUE_NAMES.INDEX, 'index-document', payload);
    this.logger.log(`enqueued index job: doc=${payload.documentId}`);
  }

  async onModuleInit() {
    const connection = new Redis({
      host: process.env.REDIS_HOST ?? 'localhost',
      port: parseInt(process.env.REDIS_PORT ?? '6379', 10),
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
    });
    this.worker = new Worker(
      QUEUE_NAMES.INDEX,
      async (job) => {
        const payload = job.data as DocumentUploadedEvent;
        await this.pipeline.run(payload.documentId, payload.versionId, payload.kbId);
        return { documentId: payload.documentId };
      },
      { connection, concurrency: QUEUE_CONCURRENCY[QUEUE_NAMES.INDEX] },
    );
    this.worker.on('failed', (job, err) => {
      this.logger.error(`index job failed: ${job?.id}`, err);
    });
    this.logger.log(`IndexConsumer started (concurrency=${QUEUE_CONCURRENCY[QUEUE_NAMES.INDEX]})`);
  }

  async onModuleDestroy() {
    await this.worker?.close();
  }
}
```

- [ ] **Step 2: 写 IndexConsumer 测试**

```typescript
import { Test } from '@nestjs/testing';
import { IndexConsumer } from './index.consumer';

describe('IndexConsumer', () => {
  it('收到 document.uploaded 后入队 index Queue', async () => {
    const queueMock = { add: jest.fn().mockResolvedValue(undefined) };
    const pipelineMock = {} as never;
    const moduleRef = await Test.createTestingModule({
      providers: [
        IndexConsumer,
        { provide: 'QueueService', useValue: queueMock },
        { provide: 'IndexPipeline', useValue: pipelineMock },
      ],
    }).compile();

    const consumer = moduleRef.get(IndexConsumer);
    await consumer.handleUploaded({ documentId: 'd1', versionId: 'v1', kbId: 'kb1' });
    expect(queueMock.add).toHaveBeenCalledWith('index', 'index-document', {
      documentId: 'd1', versionId: 'v1', kbId: 'kb1',
    });
  });
});
```

Run: `cd apps/api && npx jest src/worker/consumers/index.consumer.spec.ts --no-cache`
Expected: PASS。

- [ ] **Step 3: 实现 EmbeddingConsumer（功能3，5 并发）**

`embedding.consumer.ts`：

```typescript
import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Worker } from 'bullmq';
import Redis from 'ioredis';
import { QueueService } from '../../../infrastructure/queue/queue.service';
import { QUEUE_NAMES, QUEUE_CONCURRENCY } from '../../../infrastructure/queue/queue.constants';
import { EmbeddingService } from '../../../modules/embedding/embedding.service';
import { PrismaService } from '../../../infrastructure/database/prisma/prisma.service';
import { PersistService } from '../pipelines/persist/persist.service';

interface EmbedChunksJob {
  documentId: string;
  versionId: string;
  kbId: string;
  chunkIds: string[];
  model?: string;
  dimension: number;
  indexJobId: string;
}

/**
 * Embedding 消费者 —— ★ 独立 Queue（IO 密集，5 并发）
 * 步骤 9-13：embed → 持久化向量 → 文档 READY → job DONE → audit_log
 */
@Injectable()
export class EmbeddingConsumer implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(EmbeddingConsumer.name);
  private worker: Worker;

  constructor(
    private readonly queueService: QueueService,
    private readonly embeddingService: EmbeddingService,
    private readonly prisma: PrismaService,
    private readonly persist: PersistService,
  ) {}

  async onModuleInit() {
    const connection = new Redis({
      host: process.env.REDIS_HOST ?? 'localhost',
      port: parseInt(process.env.REDIS_PORT ?? '6379', 10),
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
    });
    this.worker = new Worker(
      QUEUE_NAMES.EMBEDDING,
      async (job) => {
        const data = job.data as EmbedChunksJob;
        await this.handle(data);
        return { documentId: data.documentId };
      },
      { connection, concurrency: QUEUE_CONCURRENCY[QUEUE_NAMES.EMBEDDING] },
    );
    this.worker.on('failed', (job, err) => {
      this.logger.error(`embedding job failed: ${job?.id}`, err);
    });
    this.logger.log(`EmbeddingConsumer started (concurrency=${QUEUE_CONCURRENCY[QUEUE_NAMES.EMBEDDING]})`);
  }

  async onModuleDestroy() {
    await this.worker?.close();
  }

  private async handle(data: EmbedChunksJob) {
    const { documentId, versionId, kbId, chunkIds, model, dimension, indexJobId } = data;

    // 9. 取 chunks → embed（60→95）
    const chunks = await this.prisma.documentChunk.findMany({
      where: { id: { in: chunkIds }, versionId },
      select: { id: true, content: true },
    });
    if (chunks.length === 0) {
      await this.completeJob(indexJobId, documentId, versionId, kbId, 0, model, dimension);
      return;
    }

    await this.prisma.indexJob.update({
      where: { id: indexJobId },
      data: { progress: 60, stepDescription: '开始向量化' },
    });

    const vectors = await this.embeddingService.embedChunks(
      chunks.map((c) => c.content),
      model,
    );

    await this.prisma.indexJob.update({
      where: { id: indexJobId },
      data: { progress: 95, stepDescription: '向量化完成，写入向量库' },
    });

    // 10. 持久化 chunk_embeddings
    await this.persist.saveEmbeddings(
      chunks.map((c, i) => ({
        chunkId: c.id,
        kbId,
        modelName: model ?? 'default',
        vector: vectors[i],
      })),
    );

    await this.completeJob(indexJobId, documentId, versionId, kbId, chunks.length, model, dimension);
  }

  private async completeJob(
    indexJobId: string,
    documentId: string,
    versionId: string,
    kbId: string,
    chunkCount: number,
    model?: string,
    dimension?: number,
  ) {
    const resolved = await this.prisma.document.findUnique({
      where: { id: documentId },
      include: { kb: { select: { embeddingModel: true } } },
    });
    const modelName = model ?? resolved?.kb.embeddingModel ?? undefined;
    const dim = dimension ?? resolved?.embeddingDim ?? undefined;

    // 11. 文档 → READY
    await this.prisma.document.update({
      where: { id: documentId },
      data: {
        status: 'READY',
        chunkCount,
        embeddingModel: modelName ?? null,
        embeddingDim: dim ?? null,
        updatedAt: new Date(),
      },
    });
    // 版本 → READY
    await this.prisma.documentVersion.update({
      where: { id: versionId },
      data: { status: 'READY', chunkCount },
    });
    // 12. job → DONE
    await this.prisma.indexJob.update({
      where: { id: indexJobId },
      data: { status: 'DONE', progress: 100, completedAt: new Date(), stepDescription: '索引完成' },
    });
    // 13. audit_log
    await this.prisma.auditLog.create({
      data: {
        userId: resolved?.userId ?? null,
        action: 'DOCUMENT_UPLOAD',
        entityType: 'document',
        entityId: documentId,
        kbId,
        details: { chunkCount, embeddingModel: modelName, embeddingDim: dim },
      },
    });
  }
}
```

- [ ] **Step 4: 实现 ReindexConsumer + ReindexPipeline（重新 embedding）**

`reindex-pipeline.ts`：

```typescript
import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database/prisma/prisma.service';
import { PersistService } from './persist/persist.service';
import { IndexPipeline } from './index-pipeline';

/**
 * Reindex Pipeline —— 清空旧 chunks + 复用 IndexPipeline 重建
 */
@Injectable()
export class ReindexPipeline {
  private readonly logger = new Logger(ReindexPipeline.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly persist: PersistService,
    private readonly indexPipeline: IndexPipeline,
  ) {}

  async run(documentId: string, versionId: string, kbId: string) {
    // 清空旧 chunks（级联删向量）
    await this.persist.deleteChunksByVersion(versionId);
    await this.prisma.documentVersion.update({
      where: { id: versionId },
      data: { chunkCount: 0, status: 'PROCESSING' },
    });
    // 复用 Index Pipeline（reindex=true → job_type=REINDEX）
    const result = await this.indexPipeline.run(documentId, versionId, kbId, { reindex: true });
    this.logger.log(`Reindex done: doc=${documentId}, chunks=${result.chunkCount}`);
    return result;
  }
}
```

`reindex.consumer.ts`：

```typescript
import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { Worker } from 'bullmq';
import Redis from 'ioredis';
import { QueueService } from '../../../infrastructure/queue/queue.service';
import { QUEUE_NAMES, QUEUE_CONCURRENCY } from '../../../infrastructure/queue/queue.constants';
import { INDEX_REQUESTED, IndexRequestedEvent } from '../../../infrastructure/event-bus/events/index-requested.event';
import { ReindexPipeline } from '../pipelines/reindex-pipeline';

@Injectable()
export class ReindexConsumer implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ReindexConsumer.name);
  private worker: Worker;

  constructor(
    private readonly queueService: QueueService,
    private readonly reindexPipeline: ReindexPipeline,
  ) {}

  @OnEvent(INDEX_REQUESTED)
  async handleIndexRequested(payload: IndexRequestedEvent) {
    await this.queueService.add(QUEUE_NAMES.REINDEX, 'reindex-document', payload);
  }

  async onModuleInit() {
    const connection = new Redis({
      host: process.env.REDIS_HOST ?? 'localhost',
      port: parseInt(process.env.REDIS_PORT ?? '6379', 10),
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
    });
    this.worker = new Worker(
      QUEUE_NAMES.REINDEX,
      async (job) => {
        const p = job.data as IndexRequestedEvent;
        await this.reindexPipeline.run(p.documentId, p.versionId, p.kbId);
      },
      { connection, concurrency: QUEUE_CONCURRENCY[QUEUE_NAMES.REINDEX] },
    );
    this.worker.on('failed', (job, err) => this.logger.error(`reindex job failed: ${job?.id}`, err));
  }

  async onModuleDestroy() {
    await this.worker?.close();
  }
}
```

- [ ] **Step 5: 实现 GcConsumer（功能4 软删除 + 异步 GC）**

`gc.consumer.ts`：

```typescript
import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { Worker } from 'bullmq';
import Redis from 'ioredis';
import { QueueService } from '../../../infrastructure/queue/queue.service';
import { QUEUE_NAMES, QUEUE_CONCURRENCY } from '../../../infrastructure/queue/queue.constants';
import { DOCUMENT_DELETED, DocumentDeletedEvent } from '../../../infrastructure/event-bus/events/document-deleted.event';
import { PrismaService } from '../../../infrastructure/database/prisma/prisma.service';
import { MinioService } from '../../../infrastructure/minio/minio.service';
import { PersistService } from '../pipelines/persist/persist.service';

/**
 * GC 消费者 —— 软删除后异步清理（delete-chunks + cleanup 两个独立 Queue）
 *
 * delete-chunks：删 document_chunks + 向量（级联）
 * cleanup：删 MinIO 对象 + audit_log
 */
@Injectable()
export class GcConsumer implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(GcConsumer.name);
  private deleteChunksWorker: Worker;
  private cleanupWorker: Worker;

  constructor(
    private readonly queueService: QueueService,
    private readonly prisma: PrismaService,
    private readonly minio: MinioService,
    private readonly persist: PersistService,
  ) {}

  @OnEvent(DOCUMENT_DELETED)
  async handleDeleted(payload: DocumentDeletedEvent) {
    await this.queueService.add(QUEUE_NAMES.DELETE_CHUNKS, 'delete-chunks', payload);
    await this.queueService.add(QUEUE_NAMES.CLEANUP, 'cleanup-document', payload);
    this.logger.log(`enqueued GC jobs: doc=${payload.documentId}`);
  }

  async onModuleInit() {
    const mkConnection = () =>
      new Redis({
        host: process.env.REDIS_HOST ?? 'localhost',
        port: parseInt(process.env.REDIS_PORT ?? '6379', 10),
        maxRetriesPerRequest: null,
        enableReadyCheck: false,
      });

    this.deleteChunksWorker = new Worker(
      QUEUE_NAMES.DELETE_CHUNKS,
      async (job) => {
        const p = job.data as DocumentDeletedEvent;
        const count = await this.persist.deleteChunksByDocument(p.documentId);
        await this.prisma.indexJob.create({
          data: {
            documentId: p.documentId,
            jobType: 'DELETE_CHUNKS',
            status: 'DONE',
            progress: 100,
            stepDescription: `清理 ${count.count} 个 chunk`,
          },
        });
        this.logger.log(`delete-chunks done: doc=${p.documentId}, count=${count.count}`);
      },
      { connection: mkConnection(), concurrency: QUEUE_CONCURRENCY[QUEUE_NAMES.DELETE_CHUNKS] },
    );

    this.cleanupWorker = new Worker(
      QUEUE_NAMES.CLEANUP,
      async (job) => {
        const p = job.data as DocumentDeletedEvent;
        const versions = await this.prisma.documentVersion.findMany({
          where: { documentId: p.documentId },
          select: { id: true, fileUrl: true },
        });
        // MinIO 清理所有版本文件
        await this.minio.deleteObjects(versions.map((v) => v.fileUrl));
        // audit_log
        await this.prisma.auditLog.create({
          data: {
            action: 'DOCUMENT_DELETE',
            entityType: 'document',
            entityId: p.documentId,
            kbId: p.kbId,
            details: { cleanedVersions: versions.length },
          },
        });
        this.logger.log(`cleanup done: doc=${p.documentId}, versions=${versions.length}`);
      },
      { connection: mkConnection(), concurrency: QUEUE_CONCURRENCY[QUEUE_NAMES.CLEANUP] },
    );

    this.deleteChunksWorker.on('failed', (job, err) => this.logger.error(`delete-chunks failed: ${job?.id}`, err));
    this.cleanupWorker.on('failed', (job, err) => this.logger.error(`cleanup failed: ${job?.id}`, err));
    this.logger.log('GcConsumer started (delete-chunks + cleanup)');
  }

  async onModuleDestroy() {
    await this.deleteChunksWorker?.close();
    await this.cleanupWorker?.close();
  }
}
```

- [ ] **Step 6: 事件接线 —— DocumentService**

在 `document.service.ts` 中注入 EventBusService 并发事件（功能1）：

```typescript
// 顶部 import
import { EventBusService } from '../../../infrastructure/event-bus/event-bus.service';
import {
  DOCUMENT_UPLOADED,
  DocumentUploadedEvent,
} from '../../../infrastructure/event-bus/events/document-uploaded.event';
import {
  DOCUMENT_DELETED,
  DocumentDeletedEvent,
} from '../../../infrastructure/event-bus/events/document-deleted.event';
import {
  INDEX_REQUESTED,
  IndexRequestedEvent,
} from '../../../infrastructure/event-bus/events/index-requested.event';

// 构造函数注入
constructor(
  private readonly prisma: PrismaService,
  private readonly minioService: MinioService,
  private readonly eventBus: EventBusService,
) {}
```

`saveMeta` 事务成功后（两个分支 `return` 前）发事件。在 `saveMeta` 的事务外层加：

```typescript
    const result = await this.prisma.$transaction(async (tx) => {
      // ... 原有事务逻辑（幂等检查/版本递增/新建）...
      return { document, version, isNew };
    });

    // ★ 功能1：发布 document.uploaded → Index Worker
    const event: DocumentUploadedEvent = {
      documentId: result.document.id,
      versionId: result.version.id,
      kbId,
    };
    await this.eventBus.emit(DOCUMENT_UPLOADED, event);
    this.logger.log(`Emitted ${DOCUMENT_UPLOADED}: doc=${result.document.id}`);

    return result;
```

`softDelete` 更新后发事件：

```typescript
    const updated = await this.prisma.document.update({
      where: { id: docId },
      data: { status: 'DELETED', updatedAt: new Date() },
    });

    // ★ 功能4：发布 document.deleted → 异步 GC
    await this.eventBus.emit(DOCUMENT_DELETED, { documentId: docId, kbId } satisfies DocumentDeletedEvent);
    return updated;
```

新增 `requestReindex` 方法：

```typescript
  /**
   * 重新索引（重新 embedding）：发布 index.requested → Reindex Worker
   */
  async requestReindex(kbId: string, docId: string) {
    const doc = await this.prisma.document.findFirst({
      where: { id: docId, kbId, status: { not: 'DELETED' } },
    });
    if (!doc) throw new NotFoundException('文档不存在或已删除');
    if (!doc.currentVersionId) throw new ConflictException('文档没有活跃版本，无法重新索引');

    const event: IndexRequestedEvent = {
      documentId: docId,
      versionId: doc.currentVersionId,
      kbId,
    };
    await this.eventBus.emit(INDEX_REQUESTED, event);
    return { reindexed: true, versionId: doc.currentVersionId };
  }
```

`document.module.ts`：

```typescript
import { Module } from '@nestjs/common';
import { DocumentService } from './document.service';
import { DocumentController } from './document.controller';

@Module({
  controllers: [DocumentController],
  providers: [DocumentService],
  exports: [DocumentService],
})
export class DocumentModule {}
```

（EventBusModule 为 @Global，无需在 DocumentModule imports 显式引入，但为可读性可加 `imports: [EventBusModule]`。保持 @Global 即足够。）

`document.controller.ts` 新增路由：

```typescript
  /**
   * POST /api/v1/knowledge-bases/:kbId/documents/:id/reindex
   * 重新 embedding
   */
  @Post(':id/reindex')
  @UseGuards(KbPermissionGuard)
  async reindex(@Param('kbId') kbId: string, @Param('id') id: string) {
    return this.documentService.requestReindex(kbId, id);
  }
```

- [ ] **Step 7: 运行全部消费者/文档测试**

Run:
```bash
cd apps/api && npx jest src/worker/consumers src/modules/knowledge/document --no-cache
```
Expected: PASS。

- [ ] **Step 8: Commit**

```bash
git add apps/api/src/worker/consumers apps/api/src/worker/pipelines/reindex-pipeline.ts apps/api/src/modules/knowledge/document
git commit -m "feat: Worker 消费者与事件接线（Index/Embedding/GC/Reindex）"
```

---

## Task 14: Session 分布式锁（功能5）

**Files:**
- Create: `apps/api/src/worker/session-lock.service.ts`
- Test: `apps/api/src/worker/session-lock.service.spec.ts`

- [ ] **Step 1: 写失败测试**

```typescript
import { SessionLockService } from './session-lock.service';

describe('SessionLockService', () => {
  const redisMock = {
    acquireLock: jest.fn(),
    releaseLock: jest.fn(),
  };
  let service: SessionLockService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new SessionLockService(redisMock as never);
  });

  it('acquire 使用 lock:session:{id} 前缀且默认 30s TTL', async () => {
    redisMock.acquireLock.mockResolvedValue(true);
    const ok = await service.acquire('abc123');
    expect(ok).toBe(true);
    expect(redisMock.acquireLock).toHaveBeenCalledWith('lock:session:abc123', 30000);
  });

  it('锁被持有（已有请求处理中）时返回 false', async () => {
    redisMock.acquireLock.mockResolvedValue(false);
    await expect(service.acquire('abc123')).resolves.toBe(false);
  });

  it('release 释放锁', async () => {
    await service.release('abc123');
    expect(redisMock.releaseLock).toHaveBeenCalledWith('lock:session:abc123');
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `cd apps/api && npx jest src/worker/session-lock.service.spec.ts --no-cache`
Expected: FAIL。

- [ ] **Step 3: 实现 SessionLockService**

`session-lock.service.ts`：

```typescript
import { Injectable } from '@nestjs/common';
import { RedisService } from '../../infrastructure/redis/redis.service';

/**
 * Session 分布式锁 —— 设计文档 2bis.2
 *
 * 同一 Session 同一时间只允许一个 LLM 请求：
 * 用户快速连点发送按钮 → 第二个请求 acquire 失败 → 返回 HTTP 429
 */
@Injectable()
export class SessionLockService {
  private static readonly KEY_PREFIX = 'lock:session:';
  private static readonly DEFAULT_TTL_MS = 30_000;

  constructor(private readonly redis: RedisService) {}

  /** 获取锁，成功返回 true；已被持有返回 false */
  async acquire(sessionId: string, ttlMs = SessionLockService.DEFAULT_TTL_MS): Promise<boolean> {
    return this.redis.acquireLock(`${SessionLockService.KEY_PREFIX}${sessionId}`, ttlMs);
  }

  /** 释放锁 */
  async release(sessionId: string): Promise<void> {
    await this.redis.releaseLock(`${SessionLockService.KEY_PREFIX}${sessionId}`);
  }
}
```

- [ ] **Step 4: 运行测试确认通过**

Run: `cd apps/api && npx jest src/worker/session-lock.service.spec.ts --no-cache`
Expected: PASS。

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/worker/session-lock.service.ts apps/api/src/worker/session-lock.service.spec.ts
git commit -m "feat: Session 分布式锁"
```

---

## Task 15: WorkerModule 组装 + AppModule 接线 + 构建验证

**Files:**
- Modify: `apps/api/src/worker/worker.module.ts`
- Modify: `apps/api/src/worker/worker.service.ts`
- Modify: `apps/api/src/worker/worker.controller.ts`（删除）
- Modify: `apps/api/src/app.module.ts`

- [ ] **Step 1: 组装 WorkerModule**

`worker.module.ts`（整体替换）：

```typescript
import { Module } from '@nestjs/common';
import { WorkerService } from './worker.service';
import { SessionLockService } from './session-lock.service';
import { IndexPipeline } from './pipelines/index-pipeline';
import { ReindexPipeline } from './pipelines/reindex-pipeline';
import { TextSplitter } from './pipelines/splitters/text-splitter';
import { TextParser } from './pipelines/parsers/text-parser';
import { PdfLoader } from './pipelines/loaders/pdf-loader';
import { MarkdownLoader } from './pipelines/loaders/markdown-loader';
import { TextLoader } from './pipelines/loaders/text-loader';
import { PersistService } from './pipelines/persist/persist.service';
import { IndexConsumer } from './consumers/index.consumer';
import { EmbeddingConsumer } from './consumers/embedding.consumer';
import { GcConsumer } from './consumers/gc.consumer';
import { ReindexConsumer } from './consumers/reindex.consumer';

@Module({
  providers: [
    WorkerService,
    SessionLockService,
    // Pipelines
    IndexPipeline,
    ReindexPipeline,
    PersistService,
    { provide: 'LOADERS', useFactory: () => [new PdfLoader(), new MarkdownLoader(), new TextLoader()] },
    { provide: 'TEXT_SPLITTER', useClass: TextSplitter },
    { provide: 'TEXT_PARSER', useClass: TextParser },
    // Consumers
    IndexConsumer,
    EmbeddingConsumer,
    GcConsumer,
    ReindexConsumer,
  ],
  exports: [SessionLockService, WorkerService],
})
export class WorkerModule {}
```

`worker.service.ts`（重写为健康检查）：

```typescript
import { Injectable, Logger } from '@nestjs/common';
import { QueueService } from '../infrastructure/queue/queue.service';
import { QUEUE_NAMES } from '../infrastructure/queue/queue.constants';
import { RedisService } from '../infrastructure/redis/redis.service';

/**
 * Worker 服务 —— 状态上报与健康检查
 */
@Injectable()
export class WorkerService {
  private readonly logger = new Logger(WorkerService.name);

  constructor(
    private readonly queueService: QueueService,
    private readonly redis: RedisService,
  ) {}

  async health() {
    const redisStatus = this.redis.getClient()?.status ?? 'disconnected';
    return {
      worker: 'running',
      redis: redisStatus,
      queues: Object.values(QUEUE_NAMES),
    };
  }
}
```

删除 `worker.controller.ts`（worker 非 HTTP 模块，占位控制器移除）。

- [ ] **Step 2: AppModule 注册新模块**

`app.module.ts` imports 中追加（保持现有顺序）：

```typescript
import { EventBusModule } from './infrastructure/event-bus/event-bus.module';
import { RedisModule } from './infrastructure/redis/redis.module';
import { QueueModule } from './infrastructure/queue/queue.module';
import { ModelProviderModule } from './modules/model-provider/model-provider.module';
import { EmbeddingModule } from './modules/embedding/embedding.module';
```

imports 数组加入：

```typescript
    EventBusModule,
    RedisModule,
    QueueModule,
    ModelProviderModule,
    EmbeddingModule,
```

（WorkerModule 已在 imports 中。）

- [ ] **Step 3: 类型检查**

Run: `cd apps/api && npx tsc --noEmit -p tsconfig.build.json`
Expected: 无错误。若 `pdf-parse` 无类型，创建 `src/types/pdf-parse.d.ts`：

```typescript
declare module 'pdf-parse' {
  interface PdfParseResult {
    text: string;
    numpages: number;
    info?: unknown;
  }
  function pdfParse(data: Buffer): Promise<PdfParseResult>;
  export = pdfParse;
}
```

- [ ] **Step 4: 构建**

Run: `cd apps/api && npx nest build`
Expected: `dist` 产出成功。

- [ ] **Step 5: 运行全部测试**

Run: `cd apps/api && npx jest --no-cache`
Expected: 全部 PASS（含既有 auth/user 等测试）。

- [ ] **Step 6: 冒烟验证（本地 Redis 存在时）**

Run: `cd apps/api && npm run start:dev`（或 `nest start`），观察日志：
```
Redis connected
Queue "index" created (concurrency=3)
Queue "embedding" created (concurrency=5)
...
IndexConsumer started (concurrency=3)
EmbeddingConsumer started (concurrency=5)
GcConsumer started (delete-chunks + cleanup)
```
Expected: 启动无异常，各 Queue/Consumer 日志出现。

- [ ] **Step 7: Commit**

```bash
git add apps/api/src/worker apps/api/src/app.module.ts
git commit -m "feat: Worker 模块组装与构建验证"
```

---

## 自检清单

- **功能覆盖**：功能1（Task 3,13）✅ 功能2（Task 8-12,13）✅ 功能3（Task 13）✅ 功能4（Task 13）✅ 功能5（Task 2,14）✅ 功能6（Task 7）✅ 统一模型提供文件（Task 5）✅。
- **占位符扫描**：全部代码已内联，无 "TBD"/"TODO"。
- **类型一致性**：`EmbeddingService.embedQuery` 返回 `QueryEmbedResult`；`ModelProviderService.resolveEmbeddingConfig` 返回 `EmbeddingModelConfig`；`IndexPipeline.run` 返回 `IndexRunResult`；`PersistService.saveChunks` 返回 `{ count, ids }`；`SessionLockService.acquire` 返回 `Promise<boolean>`。后续任务引用与此一致。
