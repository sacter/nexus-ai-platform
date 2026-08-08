# 切片详情功能 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 切片详情 tab 展示知识库全部/指定文档当前活跃版本的切片信息。

**Architecture:** 后端新增 `GET /knowledge-bases/:kbId/chunks` 查询接口（只查当前活跃版本、排除已删除文档、分页、向量化状态按 chunkId 归组）；前端在 `KnowledgeDetail` 切片 tab 内嵌 `ChunkDetail` 组件，用受控 `documentId` + `suppressReset` 标志实现「点 tab → 全部 / 点切片详情 → 该文档 / 选择器切换」三种交互语义。

**Tech Stack:** NestJS + Prisma（API）/ Vue 3 + Element Plus + vue-query（Web）

**Spec:** `docs/superpowers/specs/2026-08-08-chunk-details-design.md`

---

## 文件结构总览

**后端 `apps/api/src/modules/knowledge/chunk/`（重写死代码模块）**
- `chunk.service.ts` — 核心查询逻辑（改）
- `chunk.controller.ts` — `GET knowledge-bases/:kbId/chunks`（改）
- `chunk.module.ts` — 注册 controller + service（改）
- `chunk.service.spec.ts` — Jest 单元测试（新建）
- `dto/`、`entities/` — 无引用的死代码（删除）

**其他后端**
- `apps/api/src/app.module.ts` — 注册 `ChunkModule`（改）

**前端 `apps/web/src/modules/knowledge/`**
- `types/chunk.ts` — Chunk 类型（新建）
- `api/chunk.api.ts` — chunksApi.list（新建）
- `composables/useChunks.ts` — vue-query 查询（新建）
- `components/ChunkDetail.vue` — 切片 tab 内容组件（新建）
- `views/KnowledgeDetail.vue` — 状态协调 + 替换占位（改）

---

## Task 1: 后端 ChunkService + 单元测试（TDD）

**Files:**
- Create: `apps/api/src/modules/knowledge/chunk/chunk.service.spec.ts`
- Rewrite: `apps/api/src/modules/knowledge/chunk/chunk.service.ts`

- [ ] **Step 1: 写失败的单元测试**

创建 `apps/api/src/modules/knowledge/chunk/chunk.service.spec.ts`：

```ts
import { Test } from '@nestjs/testing';
import { ChunkService } from './chunk.service';
import { PrismaService } from '../../../infrastructure/database/prisma/prisma.service';

describe('ChunkService', () => {
  let service: ChunkService;
  const prisma = {
    document: { findFirst: jest.fn(), findMany: jest.fn() },
    documentChunk: { count: jest.fn(), findMany: jest.fn() },
    chunkEmbedding: { findMany: jest.fn() },
    $transaction: (ops: Promise<unknown>[]) => Promise.all(ops),
  };

  const chunkRow = {
    id: 'c1',
    versionId: 'v1',
    page: 2,
    chunkIndex: 3,
    content: 'hello',
    tokenCount: 5,
    metadata: { title: 'x' },
    parentChunkId: null,
    createdAt: new Date('2026-08-08T00:00:00Z'),
    version: { document: { id: 'doc1', name: '测试文档' } },
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const moduleRef = await Test.createTestingModule({
      providers: [
        ChunkService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();
    service = moduleRef.get(ChunkService);
  });

  it('指定 documentId 但文档不存在/无活跃版本 → 返回空结果', async () => {
    prisma.document.findFirst.mockResolvedValue(null);
    const result = await service.listChunks('kb1', { documentId: 'docX' });
    expect(result).toEqual({ items: [], total: 0, page: 1, pageSize: 20 });
    expect(prisma.documentChunk.findMany).not.toHaveBeenCalled();
  });

  it('知识库内无任何文档 → 返回空结果', async () => {
    prisma.document.findMany.mockResolvedValue([]);
    const result = await service.listChunks('kb1', {});
    expect(result).toEqual({ items: [], total: 0, page: 1, pageSize: 20 });
  });

  it('按 documentId 过滤：只查该文档活跃版本，并附文档名与向量化状态', async () => {
    prisma.document.findFirst.mockResolvedValue({ currentVersionId: 'v1' });
    prisma.documentChunk.count.mockResolvedValue(1);
    prisma.documentChunk.findMany.mockResolvedValue([chunkRow]);
    prisma.chunkEmbedding.findMany.mockResolvedValue([
      { chunkId: 'c1', modelName: 'bge-m3' },
    ]);

    const result = await service.listChunks('kb1', {
      documentId: 'doc1',
      page: 1,
      pageSize: 20,
    });

    expect(prisma.document.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: 'doc1', kbId: 'kb1' }),
      }),
    );
    expect(prisma.documentChunk.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { versionId: { in: ['v1'] } },
        skip: 0,
        take: 20,
      }),
    );
    expect(result.total).toBe(1);
    expect(result.items[0]).toEqual(
      expect.objectContaining({
        documentId: 'doc1',
        documentName: '测试文档',
        page: 2,
        chunkIndex: 3,
        content: 'hello',
        tokenCount: 5,
        isEmbedded: true,
        embeddingModels: ['bge-m3'],
      }),
    );
  });

  it('全部视图：收集所有非删除文档的活跃版本 id，分页并排除无活跃版本的文档', async () => {
    prisma.document.findMany.mockResolvedValue([
      { currentVersionId: 'v1' },
      { currentVersionId: 'v2' },
      { currentVersionId: null },
    ]);
    prisma.documentChunk.count.mockResolvedValue(2);
    prisma.documentChunk.findMany.mockResolvedValue([]);
    prisma.chunkEmbedding.findMany.mockResolvedValue([]);

    const result = await service.listChunks('kb1', { page: 2, pageSize: 10 });

    expect(prisma.document.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ kbId: 'kb1', status: { not: 'DELETED' } }),
      }),
    );
    expect(prisma.documentChunk.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { versionId: { in: ['v1', 'v2'] } },
        skip: 10,
        take: 10,
      }),
    );
    expect(result.total).toBe(2);
    expect(result.page).toBe(2);
    expect(result.pageSize).toBe(10);
  });

  it('无 embedding 记录 → isEmbedded=false 且 embeddingModels 为空', async () => {
    prisma.document.findMany.mockResolvedValue([{ currentVersionId: 'v1' }]);
    prisma.documentChunk.count.mockResolvedValue(1);
    prisma.documentChunk.findMany.mockResolvedValue([chunkRow]);
    prisma.chunkEmbedding.findMany.mockResolvedValue([]);

    const result = await service.listChunks('kb1', {});
    expect(result.items[0].isEmbedded).toBe(false);
    expect(result.items[0].embeddingModels).toEqual([]);
  });

  it('page/pageSize 钳制：page 至少 1，pageSize 上限 100', async () => {
    prisma.document.findMany.mockResolvedValue([{ currentVersionId: 'v1' }]);
    prisma.documentChunk.count.mockResolvedValue(0);
    prisma.documentChunk.findMany.mockResolvedValue([]);
    prisma.chunkEmbedding.findMany.mockResolvedValue([]);

    const result = await service.listChunks('kb1', { page: 0, pageSize: 9999 });
    expect(result.page).toBe(1);
    expect(result.pageSize).toBe(100);
  });
});
```

- [ ] **Step 2: 运行测试，确认失败（红）**

Run: `cd apps/api && pnpm test chunk.service`
Expected: FAIL —— 编译错误「Property 'listChunks' does not exist on type 'ChunkService'」（旧 service 无该方法）。

- [ ] **Step 3: 重写 ChunkService 实现**

将 `apps/api/src/modules/knowledge/chunk/chunk.service.ts` 整体替换为：

```ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database/prisma/prisma.service';
import type { Prisma } from '@prisma/client';

export interface ListChunksQuery {
  documentId?: string;
  page?: number;
  pageSize?: number;
}

export interface ChunkListItem {
  id: string;
  documentId: string;
  documentName: string;
  versionId: string;
  page: number;
  chunkIndex: number;
  content: string;
  tokenCount: number;
  metadata: Prisma.JsonValue;
  parentChunkId: string | null;
  isEmbedded: boolean;
  embeddingModels: string[];
  createdAt: Date;
}

export interface ChunkListResult {
  items: ChunkListItem[];
  total: number;
  page: number;
  pageSize: number;
}

@Injectable()
export class ChunkService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * 查询知识库切片列表
   *
   * 口径：
   * - 只查当前活跃版本（document.currentVersionId）的切片，排除历史版本
   * - 排除 status = DELETED 的文档
   * - documentId 缺省时聚合库内全部非删除文档的活跃版本
   * - 向量化状态按当前页 chunkId 集合一次归组
   */
  async listChunks(kbId: string, query: ListChunksQuery): Promise<ChunkListResult> {
    const page =
      Number.isFinite(query.page) && query.page! >= 1 ? Math.floor(query.page!) : 1;
    const pageSize =
      Number.isFinite(query.pageSize) && query.pageSize! >= 1
        ? Math.min(100, Math.floor(query.pageSize!))
        : 20;

    // 1. 解析目标活跃版本 id 集合
    let versionIds: string[];
    if (query.documentId) {
      const doc = await this.prisma.document.findFirst({
        where: { id: query.documentId, kbId, status: { not: 'DELETED' } },
        select: { currentVersionId: true },
      });
      if (!doc?.currentVersionId) {
        return { items: [], total: 0, page, pageSize };
      }
      versionIds = [doc.currentVersionId];
    } else {
      const docs = await this.prisma.document.findMany({
        where: { kbId, status: { not: 'DELETED' } },
        select: { currentVersionId: true },
      });
      versionIds = docs
        .map((d) => d.currentVersionId)
        .filter((id): id is string => id !== null);
      if (versionIds.length === 0) {
        return { items: [], total: 0, page, pageSize };
      }
    }

    // 2. count + findMany（同一 where，事务内一致性）
    const where: Prisma.DocumentChunkWhereInput = { versionId: { in: versionIds } };
    const [total, chunks] = await this.prisma.$transaction([
      this.prisma.documentChunk.count({ where }),
      this.prisma.documentChunk.findMany({
        where,
        include: {
          version: {
            select: {
              document: { select: { id: true, name: true } },
            },
          },
        },
        orderBy: [
          { version: { documentId: 'asc' } },
          { page: 'asc' },
          { chunkIndex: 'asc' },
        ],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);

    // 3. 向量化状态归组（仅当前页 chunkId）
    const embRows = await this.prisma.chunkEmbedding.findMany({
      where: { chunkId: { in: chunks.map((c) => c.id) } },
      select: { chunkId: true, modelName: true },
    });
    const embMap = new Map<string, string[]>();
    for (const r of embRows) {
      const list = embMap.get(r.chunkId) ?? [];
      list.push(r.modelName);
      embMap.set(r.chunkId, list);
    }

    // 4. 组装
    const items: ChunkListItem[] = chunks.map((c) => {
      const models = embMap.get(c.id) ?? [];
      return {
        id: c.id,
        documentId: c.version.document.id,
        documentName: c.version.document.name,
        versionId: c.versionId,
        page: c.page,
        chunkIndex: c.chunkIndex,
        content: c.content,
        tokenCount: c.tokenCount,
        metadata: c.metadata,
        parentChunkId: c.parentChunkId,
        isEmbedded: models.length > 0,
        embeddingModels: models,
        createdAt: c.createdAt,
      };
    });

    return { items, total, page, pageSize };
  }
}
```

- [ ] **Step 4: 运行测试，确认通过（绿）**

Run: `cd apps/api && pnpm test chunk.service`
Expected: PASS，6 个用例全部通过。

- [ ] **Step 5: 提交**

```bash
git add apps/api/src/modules/knowledge/chunk/chunk.service.ts apps/api/src/modules/knowledge/chunk/chunk.service.spec.ts
git commit -m "feat(api): 切片列表查询服务 listChunks + 单元测试"
```

---

## Task 2: 后端 ChunkController + 模块注册 + 清理死代码

**Files:**
- Rewrite: `apps/api/src/modules/knowledge/chunk/chunk.controller.ts`
- Rewrite: `apps/api/src/modules/knowledge/chunk/chunk.module.ts`
- Modify: `apps/api/src/app.module.ts`
- Delete: `apps/api/src/modules/knowledge/chunk/dto/create-chunk.dto.ts`, `apps/api/src/modules/knowledge/chunk/dto/update-chunk.dto.ts`, `apps/api/src/modules/knowledge/chunk/entities/chunk.entity.ts`

- [ ] **Step 1: 重写 ChunkController**

将 `apps/api/src/modules/knowledge/chunk/chunk.controller.ts` 整体替换为：

```ts
import { Controller, Get, Param, Query } from '@nestjs/common';
import { ChunkService } from './chunk.service';

/**
 * 切片控制器
 *
 * 路由前缀：/api/v1/knowledge-bases/:kbId/chunks
 * 安全：读接口沿用全局 AuthGuard（与 GET documents 一致），viewer 可查看
 */
@Controller('knowledge-bases/:kbId/chunks')
export class ChunkController {
  constructor(private readonly chunkService: ChunkService) {}

  /**
   * GET /api/v1/knowledge-bases/:kbId/chunks?documentId=&page=&pageSize=
   * 分页查询切片；documentId 缺省 = 全部文档
   */
  @Get()
  list(
    @Param('kbId') kbId: string,
    @Query('documentId') documentId?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.chunkService.listChunks(kbId, {
      documentId,
      page: page ? Number(page) : undefined,
      pageSize: pageSize ? Number(pageSize) : undefined,
    });
  }
}
```

- [ ] **Step 2: 重写 ChunkModule**

将 `apps/api/src/modules/knowledge/chunk/chunk.module.ts` 整体替换为：

```ts
import { Module } from '@nestjs/common';
import { ChunkController } from './chunk.controller';
import { ChunkService } from './chunk.service';

@Module({
  controllers: [ChunkController],
  providers: [ChunkService],
})
export class ChunkModule {}
```

- [ ] **Step 3: 注册进 app.module.ts**

在 `apps/api/src/app.module.ts`：
- import 区第 19 行后新增：`import { ChunkModule } from './modules/knowledge/chunk/chunk.module';`
- imports 数组（`VersionModule,` 之后）新增：`    ChunkModule,`

- [ ] **Step 4: 删除死代码**

```bash
rm apps/api/src/modules/knowledge/chunk/dto/create-chunk.dto.ts \
   apps/api/src/modules/knowledge/chunk/dto/update-chunk.dto.ts \
   apps/api/src/modules/knowledge/chunk/entities/chunk.entity.ts
rmdir apps/api/src/modules/knowledge/chunk/dto apps/api/src/modules/knowledge/chunk/entities
```

- [ ] **Step 5: 全量编译校验**

Run: `cd apps/api && pnpm build`
Expected: SUCCESS（nest build 通过，无类型错误）。同时跑一次全量测试：`cd apps/api && pnpm test` 全部通过。

- [ ] **Step 6: 提交**

```bash
git add apps/api/src/modules/knowledge/chunk apps/api/src/app.module.ts
git commit -m "feat(api): 注册切片查询接口 GET /knowledge-bases/:kbId/chunks"
```

---

## Task 3: 前端 types + api + composable

**Files:**
- Create: `apps/web/src/modules/knowledge/types/chunk.ts`
- Create: `apps/web/src/modules/knowledge/api/chunk.api.ts`
- Create: `apps/web/src/modules/knowledge/composables/useChunks.ts`

- [ ] **Step 1: 创建类型定义**

创建 `apps/web/src/modules/knowledge/types/chunk.ts`：

```ts
/** 切片 */
export interface Chunk {
  id: string
  documentId: string
  documentName: string
  versionId: string
  page: number
  chunkIndex: number
  content: string
  tokenCount: number
  metadata: Record<string, unknown>
  parentChunkId: string | null
  isEmbedded: boolean
  embeddingModels: string[]
  createdAt: string
}

/** 切片列表查询参数 */
export interface ChunkListParams {
  documentId?: string
  page?: number
  pageSize?: number
}

/** 切片列表响应 */
export interface ChunkListResponse {
  items: Chunk[]
  total: number
  page: number
  pageSize: number
}
```

- [ ] **Step 2: 创建 API**

创建 `apps/web/src/modules/knowledge/api/chunk.api.ts`：

```ts
import http from '@/api/client'
import type { ChunkListParams, ChunkListResponse } from '@/modules/knowledge/types/chunk'

export const chunksApi = {
  /** 分页查询知识库切片；documentId 缺省 = 全部文档 */
  list: (kbId: string, params?: ChunkListParams) =>
    http.get<ChunkListResponse>(`/knowledge-bases/${kbId}/chunks`, { params }),
}
```

- [ ] **Step 3: 创建 composable**

创建 `apps/web/src/modules/knowledge/composables/useChunks.ts`（与 `useDocuments` 相同模式）：

```ts
import { useQuery } from '@tanstack/vue-query'
import { toValue, type MaybeRefOrGetter } from 'vue'
import { chunksApi } from '@/modules/knowledge/api/chunk.api'

/** 分页查询切片（documentId 为空 = 全部文档） */
export function useChunks(
  kbId: MaybeRefOrGetter<string>,
  documentId: MaybeRefOrGetter<string>,
  page: MaybeRefOrGetter<number>,
  pageSize: MaybeRefOrGetter<number>,
) {
  return useQuery({
    queryKey: ['chunks', kbId, documentId, page, pageSize],
    queryFn: () =>
      chunksApi.list(toValue(kbId), {
        documentId: toValue(documentId) || undefined,
        page: toValue(page),
        pageSize: toValue(pageSize),
      }),
    enabled: () => !!toValue(kbId),
  })
}
```

- [ ] **Step 4: 类型检查**

Run: `cd apps/web && pnpm check-types`
Expected: SUCCESS（vue-tsc --noEmit 无错误）。

- [ ] **Step 5: 提交**

```bash
git add apps/web/src/modules/knowledge/types/chunk.ts apps/web/src/modules/knowledge/api/chunk.api.ts apps/web/src/modules/knowledge/composables/useChunks.ts
git commit -m "feat(web): 切片列表 types/api/useChunks 查询"
```

---

## Task 4: 前端 ChunkDetail 组件

**Files:**
- Create: `apps/web/src/modules/knowledge/components/ChunkDetail.vue`

- [ ] **Step 1: 创建组件**

创建 `apps/web/src/modules/knowledge/components/ChunkDetail.vue`：

```vue
<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useDocuments } from '@/modules/knowledge/composables/useDocuments'
import { useChunks } from '@/modules/knowledge/composables/useChunks'

const props = defineProps<{
  kbId: string
  /** '' = 全部文档 */
  documentId: string
}>()

const emit = defineEmits<{
  (e: 'update:documentId', value: string): void
}>()

const page = ref(1)
const pageSize = ref(20)

// 受控文档选择：getter 读父组件状态，setter 回传
const selectedDocId = computed({
  get: () => props.documentId,
  set: (val: string) => emit('update:documentId', val),
})

// props.documentId 是普通 string，须包成 computed 才能让 vue-query 响应式追踪
const documentIdRef = computed(() => props.documentId)

const { data: docs } = useDocuments(props.kbId)
const { data: chunkData, isLoading } = useChunks(props.kbId, documentIdRef, page, pageSize)

// 外部 documentId 变化（切片详情点击/选择器切换/重置）→ 回到第 1 页
watch(
  documentIdRef,
  () => {
    page.value = 1
  },
)

const items = computed(() => chunkData.value?.items ?? [])
const total = computed(() => chunkData.value?.total ?? 0)

const selectedDocName = computed(() => {
  if (!props.documentId) return ''
  return docs.value?.find((d) => d.id === props.documentId)?.name ?? ''
})

const emptyText = computed(() =>
  props.documentId
    ? `文档「${selectedDocName.value || props.documentId}」暂无切片数据`
    : '暂无切片数据',
)
</script>

<template>
  <div>
    <div class="mb-4">
      <el-select v-model="selectedDocId" style="width: 260px">
        <el-option label="全部文档" value="" />
        <el-option v-for="d in docs || []" :key="d.id" :label="d.name" :value="d.id" />
      </el-select>
    </div>

    <el-table
      :data="items"
      v-loading="isLoading"
      border
      :empty-text="emptyText"
    >
      <el-table-column type="expand">
        <template #default="{ row }">
          <div class="px-4 py-2 text-sm leading-6 whitespace-pre-wrap" style="color: var(--foreground)">
            {{ row.content }}
          </div>
        </template>
      </el-table-column>

      <el-table-column v-if="!props.documentId" label="文档" min-width="180" show-overflow-tooltip>
        <template #default="{ row }">{{ row.documentName }}</template>
      </el-table-column>

      <el-table-column label="页码 · 序号" width="110" align="center">
        <template #default="{ row }">P{{ row.page }} · #{{ row.chunkIndex }}</template>
      </el-table-column>

      <el-table-column label="内容" min-width="320">
        <template #default="{ row }">
          <div class="chunk-preview">{{ row.content }}</div>
        </template>
      </el-table-column>

      <el-table-column label="Token" width="90" align="right">
        <template #default="{ row }">{{ row.tokenCount }}</template>
      </el-table-column>

      <el-table-column label="向量化状态" width="160" align="center">
        <template #default="{ row }">
          <el-tag v-if="row.isEmbedded" type="success" size="small">
            已向量化 · {{ row.embeddingModels.join(', ') }}
          </el-tag>
          <el-tag v-else type="warning" size="small">未向量化</el-tag>
        </template>
      </el-table-column>
    </el-table>

    <div v-if="total > 0" class="flex justify-end mt-4">
      <el-pagination
        v-model:current-page="page"
        v-model:page-size="pageSize"
        :total="total"
        :page-sizes="[20, 50, 100]"
        layout="total, sizes, prev, pager, next"
      />
    </div>
  </div>
</template>

<style scoped>
.chunk-preview {
  color: var(--foreground, #303133);
  overflow: hidden;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}
</style>
```

- [ ] **Step 2: 类型检查**

Run: `cd apps/web && pnpm check-types`
Expected: SUCCESS。

- [ ] **Step 3: 提交**

```bash
git add apps/web/src/modules/knowledge/components/ChunkDetail.vue
git commit -m "feat(web): ChunkDetail 切片详情组件（文档选择器+分页表格）"
```

---

## Task 5: 前端 KnowledgeDetail 接线

**Files:**
- Modify: `apps/web/src/modules/knowledge/views/KnowledgeDetail.vue`

- [ ] **Step 1: 引入组件与新增状态**

在 `KnowledgeDetail.vue`：
1. import 区（`DocumentList` import 之后）新增：
   `import ChunkDetail from '@/modules/knowledge/components/ChunkDetail.vue'`
2. 删除第 33-34 行 `selectedDocId` / `selectedDocName` 两个 ref。
3. 在第 35 行 `activeTab` 附近新增状态与协调逻辑：

```ts
// 切片 tab 文档选择（受控）：'' = 全部
const chunkDocId = ref('')
// 区分「切片详情」触发 vs 直接点 tab：前者不重置选择
const suppressReset = ref(false)

watch(activeTab, (tab) => {
  if (tab === 'chunks' && !suppressReset.value) {
    chunkDocId.value = ''
  }
  suppressReset.value = false
})
```

- [ ] **Step 2: 改写 handleViewChunks**

将 `handleViewChunks`（当前 71-75 行）替换为：

```ts
function handleViewChunks(row: DocType) {
  suppressReset.value = true
  chunkDocId.value = row.id
  activeTab.value = 'chunks'
}
```

- [ ] **Step 3: 替换切片 tab 占位**

将模板中 `el-tab-pane label="切片详情" name="chunks"` 内的整个占位 `<div class="flex items-center justify-center py-20">...</div>` 块替换为：

```vue
<el-tab-pane label="切片详情" name="chunks">
  <ChunkDetail
    :kb-id="kbId"
    :document-id="chunkDocId"
    @update:document-id="chunkDocId = $event"
  />
</el-tab-pane>
```

- [ ] **Step 4: 类型检查**

Run: `cd apps/web && pnpm check-types`
Expected: SUCCESS。

- [ ] **Step 5: 提交**

```bash
git add apps/web/src/modules/knowledge/views/KnowledgeDetail.vue
git commit -m "feat(web): KnowledgeDetail 切片 tab 接入 ChunkDetail（suppressReset 协调交互）"
```

---

## Task 6: 端到端手动验证

- [ ] **Step 1: 后端验证（需本地环境：Postgres/MinIO/Redis 已启动）**

启动 API：`cd apps/api && pnpm dev`，用已登录用户的 token 执行：

```bash
# 全部视图（第 1 页）
curl -H "Authorization: Bearer $TOKEN" "http://localhost:3000/api/v1/knowledge-bases/$KB_ID/chunks?page=1&pageSize=20"
# 按文档过滤
curl -H "Authorization: Bearer $TOKEN" "http://localhost:3000/api/v1/knowledge-bases/$KB_ID/chunks?documentId=$DOC_ID&page=1&pageSize=20"
# 分页边界
curl -H "Authorization: Bearer $TOKEN" "http://localhost:3000/api/v1/knowledge-bases/$KB_ID/chunks?page=2&pageSize=5"
```

Expected：返回 `{ items, total, page, pageSize }`；`documentId` 过滤后 items 全属于该文档；分页 total 正确；向量化完成的文档 `isEmbedded=true` 且 `embeddingModels` 非空。

- [ ] **Step 2: 前端三条路径验证**

启动 web：`cd apps/web && pnpm dev`，打开知识库详情：
1. **直接点「切片详情」tab** → 显示「全部文档」的切片（含「文档」列）。
2. 在「原始文档」tab 点某文档「切片详情」→ 跳转切片 tab，选择器选中该文档，列表为该文档切片（无「文档」列）。
3. 在切片 tab 切换选择器到另一文档 / 「全部文档」→ 列表与分页正确刷新。
4. 展开行显示全文；空文档显示「文档「xxx」暂无切片数据」。

- [ ] **Step 3: 回归 + 收尾**

```bash
cd apps/api && pnpm test          # 全量后端测试通过
cd apps/web && pnpm check-types   # 前端类型检查通过
cd apps/api && pnpm build         # 后端编译通过
```

预期全部通过，功能完成。
