# DocumentList 分页 + 列表页底部填充布局 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为 DocumentList 增加服务端分页（el-pagination + 接口分页），并把 KnowledgeDetail 与独立文档管理页的列表卡片改为高度到页面底部 12px、表格内部滚动。

**Architecture:** 后端 `findByKbId` 可选分页参数：提供时返回 `{ items, total, page, pageSize }`（对齐 `ChunkService.listChunks` 口径），缺失时保持返回全量数组（ChunkDetail 选择器 / DocumentUpload 版本分组依赖全量）。前端保留 `useDocuments`（全量），新增 `usePagedDocuments` 供 DocumentList 使用。布局用 flex column + `calc(100vh - 84px)` 让卡片填满剩余高度。

**Tech Stack:** NestJS / Prisma / Jest（apps/api），Vue 3 / Vue Query / Element Plus / Tailwind（apps/web）。

**Spec:** `docs/superpowers/specs/2026-08-08-document-list-pagination-layout-design.md`

---

## 文件结构

**后端**
- Modify `apps/api/src/modules/knowledge/document/document.service.ts` — `findByKbId` 分页
- Modify `apps/api/src/modules/knowledge/document/document.controller.ts` — `page`/`pageSize` query
- Create `apps/api/src/modules/knowledge/document/document.service.spec.ts` — 分页单测

**前端**
- Modify `apps/web/src/modules/knowledge/types/document.ts` — 新增 `DocumentListResponse`
- Modify `apps/web/src/modules/knowledge/api/document.api.ts` — 新增 `listPaged`
- Modify `apps/web/src/modules/knowledge/composables/useDocuments.ts` — 新增 `usePagedDocuments`
- Modify `apps/web/src/modules/knowledge/views/DocumentList.vue` — 分页 + 布局
- Modify `apps/web/src/modules/knowledge/views/KnowledgeDetail.vue` — Tabs 卡片底部填充布局
- Modify `apps/web/src/modules/knowledge/components/ChunkDetail.vue` — 切片表格填满/内部滚动

---

## Task 1: 后端 — 分页化 findByKbId（TDD）

**Files:**
- Modify: `apps/api/src/modules/knowledge/document/document.service.ts:182-206`
- Modify: `apps/api/src/modules/knowledge/document/document.controller.ts:58-69`
- Create: `apps/api/src/modules/knowledge/document/document.service.spec.ts`

- [ ] **Step 1: 写失败的测试**

创建 `apps/api/src/modules/knowledge/document/document.service.spec.ts`：

```ts
import { Test } from '@nestjs/testing';
import { DocumentService } from './document.service';
import { PrismaService } from '../../../infrastructure/database/prisma/prisma.service';
import { MinioService } from '../../../infrastructure/minio/minio.service';
import { EventBusService } from '../../../infrastructure/event-bus/event-bus.service';

describe('DocumentService.findByKbId', () => {
  let service: DocumentService;
  const prisma = {
    document: { findMany: jest.fn(), count: jest.fn() },
    $transaction: (ops: Promise<unknown>[]) => Promise.all(ops),
  };

  const docRow = {
    id: 'doc1',
    kbId: 'kb1',
    name: '测试.pdf',
    status: 'READY',
    currentVersion: { id: 'v1', versionNumber: 1, status: 'READY' },
    user: { id: 'u1', username: 'alice' },
    createdAt: new Date('2026-08-08T00:00:00Z'),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const moduleRef = await Test.createTestingModule({
      providers: [
        DocumentService,
        { provide: PrismaService, useValue: prisma },
        { provide: MinioService, useValue: {} },
        { provide: EventBusService, useValue: { emit: jest.fn() } },
      ],
    }).compile();
    service = moduleRef.get(DocumentService);
  });

  it('未提供分页参数 → 返回全量数组且不调用 count', async () => {
    prisma.document.findMany.mockResolvedValue([docRow]);
    const result = await service.findByKbId('kb1');
    expect(result).toEqual([docRow]);
    expect(prisma.document.count).not.toHaveBeenCalled();
  });

  it('提供分页参数 → count + findMany(skip/take) 并返回 envelope', async () => {
    prisma.document.count.mockResolvedValue(3);
    prisma.document.findMany.mockResolvedValue([docRow]);
    const result = await service.findByKbId('kb1', { page: 2, pageSize: 20 });
    expect(prisma.document.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 20, take: 20 }),
    );
    expect(result).toEqual({ items: [docRow], total: 3, page: 2, pageSize: 20 });
  });

  it('非法分页值归一化：page<1 → 1，pageSize>100 → 100', async () => {
    prisma.document.count.mockResolvedValue(0);
    prisma.document.findMany.mockResolvedValue([]);
    const result = await service.findByKbId('kb1', { page: 0, pageSize: 999 });
    expect(prisma.document.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 0, take: 100 }),
    );
    expect(result).toEqual({ items: [], total: 0, page: 1, pageSize: 100 });
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `cd apps/api && npx jest document.service.spec --silent=false`
Expected: FAIL — `findByKbId` 带 `page/pageSize` 参数调用报 TS 编译错误或返回值 shape 不符。

- [ ] **Step 3: 实现 service 分页**

替换 `apps/api/src/modules/knowledge/document/document.service.ts` 的 `findByKbId`（原 182-206 行）为：

```ts
  /**
   * 查询知识库下的文档列表
   *
   * 提供 page/pageSize 时返回分页 envelope { items, total, page, pageSize }
   * （对齐 ChunkService.listChunks 口径）；未提供时返回全量数组（向后兼容：
   * ChunkDetail 文档选择器 / DocumentUpload 版本分组依赖全量数据）。
   */
  async findByKbId(
    kbId: string,
    params?: { status?: DocumentStatus; page?: number; pageSize?: number },
  ) {
    const where: Prisma.DocumentWhereInput = {
      kbId,
      ...(params?.status
        ? { status: params.status }
        : { status: { not: 'DELETED' } }),
    };

    const include = {
      currentVersion: {
        select: { id: true, versionNumber: true, status: true },
      },
      user: { select: { id: true, username: true } },
    } satisfies Prisma.DocumentInclude;

    // 分页参数缺失 → 返回全量数组（向后兼容）
    if (!Number.isFinite(params?.page) || !Number.isFinite(params?.pageSize)) {
      return this.prisma.document.findMany({
        where,
        include,
        orderBy: { createdAt: 'desc' },
      });
    }

    const page = Math.max(1, Math.floor(params!.page!));
    const pageSize = Math.min(100, Math.max(1, Math.floor(params!.pageSize!)));

    const [total, items] = await this.prisma.$transaction([
      this.prisma.document.count({ where }),
      this.prisma.document.findMany({
        where,
        include,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);

    return { items, total, page, pageSize };
  }
```

- [ ] **Step 4: 运行测试确认通过**

Run: `cd apps/api && npx jest document.service.spec --silent=false`
Expected: 3 个用例全部 PASS。

- [ ] **Step 5: controller 增加分页 query 参数**

修改 `apps/api/src/modules/knowledge/document/document.controller.ts`：
1. 第 1 行 import 增加 `ParseIntPipe`：

```ts
import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Query,
  ParseIntPipe,
} from '@nestjs/common';
```

2. 替换 `findByKbId`（原 58-69 行）为：

```ts
  @Get()
  async findByKbId(
    @Param('kbId') kbId: string,
    @Query('status') status?: string,
    @Query('page', new ParseIntPipe({ optional: true })) page?: number,
    @Query('pageSize', new ParseIntPipe({ optional: true })) pageSize?: number,
  ) {
    // 仅接受合法的 DocumentStatus 枚举值，非法值忽略（不传即排除已删除）
    const validStatuses = Object.values(DocumentStatus) as string[];
    const parsedStatus = validStatuses.includes(status ?? '')
      ? (status as DocumentStatus)
      : undefined;
    return this.documentService.findByKbId(kbId, {
      status: parsedStatus,
      page,
      pageSize,
    });
  }
```

- [ ] **Step 6: 全量 api 测试确认无回归 + Commit**

Run: `cd apps/api && npx jest --silent`
Expected: 全部 PASS。

```bash
git add apps/api/src/modules/knowledge/document/
git commit -m "feat(api): 文档列表接口支持分页（page/pageSize），缺省保持全量兼容"
```

---

## Task 2: 前端 — types / api / composable

**Files:**
- Modify: `apps/web/src/modules/knowledge/types/document.ts`
- Modify: `apps/web/src/modules/knowledge/api/document.api.ts`
- Modify: `apps/web/src/modules/knowledge/composables/useDocuments.ts`

- [ ] **Step 1: 新增 DocumentListResponse 类型**

在 `apps/web/src/modules/knowledge/types/document.ts` 的 `DocumentVersion` 接口前新增：

```ts
/** 文档列表分页响应 */
export interface DocumentListResponse {
  items: Document[]
  total: number
  page: number
  pageSize: number
}
```

- [ ] **Step 2: api 新增 listPaged**

修改 `apps/web/src/modules/knowledge/api/document.api.ts`：
1. import 类型行增加 `DocumentListResponse`：

```ts
import type {
  Document,
  DocumentVersion,
  StsCredentials,
  SaveMetaRequest,
  SaveMetaResponse,
  DownloadUrlResponse,
  ReindexResponse,
  DocumentListResponse,
} from '@/modules/knowledge/types/document'
```

2. 在 `list` 方法后新增：

```ts
  /** 分页查询文档列表 */
  listPaged: (kbId: string, params: { page: number; pageSize: number }) =>
    http.get<DocumentListResponse>(`/knowledge-bases/${kbId}/documents`, { params }),
```

- [ ] **Step 3: composable 新增 usePagedDocuments**

在 `apps/web/src/modules/knowledge/composables/useDocuments.ts` 的 `useDocuments` 后新增：

```ts
/** 分页查询知识库下的文档列表（列表页用；选择器/上传仍走全量 useDocuments） */
export function usePagedDocuments(
  kbId: MaybeRefOrGetter<string>,
  page: MaybeRefOrGetter<number>,
  pageSize: MaybeRefOrGetter<number>,
) {
  return useQuery({
    queryKey: ['documents', kbId, 'paged', page, pageSize],
    queryFn: () =>
      documentsApi.listPaged(toValue(kbId), {
        page: toValue(page),
        pageSize: toValue(pageSize),
      }),
    enabled: () => !!toValue(kbId),
  })
}
```

- [ ] **Step 4: 类型检查 + Commit**

Run: `cd apps/web && npx vue-tsc -b`
Expected: 无类型错误。

```bash
git add apps/web/src/modules/knowledge/types/document.ts apps/web/src/modules/knowledge/api/document.api.ts apps/web/src/modules/knowledge/composables/useDocuments.ts
git commit -m "feat(web): 文档列表分页 types/api/usePagedDocuments"
```

---

## Task 3: 前端 — DocumentList 分页 UI

**Files:**
- Modify: `apps/web/src/modules/knowledge/views/DocumentList.vue`

- [ ] **Step 1: script 改用 usePagedDocuments + 分页状态**

修改 `apps/web/src/modules/knowledge/views/DocumentList.vue`：
1. 第 1 行 import `computed, ref` 改为 `computed, ref, watch`。
2. 第 6 行 import 增加 `usePagedDocuments`：

```ts
import { usePagedDocuments, useDeleteDocument, useDownloadUrl, useReindexDocument } from '@/modules/knowledge/composables/useDocuments'
```

3. 替换第 30 行：

```ts
const { data: docs, isLoading, refetch } = useDocuments(kbId)
```

为：

```ts
const page = ref(1)
const pageSize = ref(20)
const { data: docData, isLoading, refetch } = usePagedDocuments(kbId, page, pageSize)
const total = computed(() => docData.value?.total ?? 0)

// 删除/刷新后当前页可能越界 → 回退到最后一页
watch(total, (t) => {
  const maxPage = Math.max(1, Math.ceil(t / pageSize.value))
  if (page.value > maxPage) page.value = maxPage
})
```

4. 替换第 45 行 `docsList` computed：

```ts
const docsList = computed(() => (docData.value?.items || []).map((doc) => {
```

（其余 map 逻辑不变。）

- [ ] **Step 2: 模板增加 el-pagination**

在 `apps/web/src/modules/knowledge/views/DocumentList.vue` 的 `</el-table>`（第 331 行）后、`</div>`（table-section 结束）前插入：

```html
      <div v-if="total > 0" class="table-pagination flex justify-end mt-4">
        <el-pagination
          v-model:current-page="page"
          v-model:page-size="pageSize"
          :total="total"
          :page-sizes="[20, 50, 100]"
          layout="total, sizes, prev, pager, next, jumper"
        />
      </div>
```

- [ ] **Step 3: 类型检查 + Commit**

Run: `cd apps/web && npx vue-tsc -b`
Expected: 无类型错误。

```bash
git add apps/web/src/modules/knowledge/views/DocumentList.vue
git commit -m "feat(web): DocumentList 接入分页（el-pagination + usePagedDocuments）"
```

---

## Task 4: 布局 — DocumentList 表格区填满/内部滚动

**Files:**
- Modify: `apps/web/src/modules/knowledge/views/DocumentList.vue`

- [ ] **Step 1: 表格加 height="100%"**

在 `apps/web/src/modules/knowledge/views/DocumentList.vue` 的 `<el-table`（第 169 行）上增加 `height="100%"`：

```html
      <el-table
        :data="docsList"
        v-loading="isLoading"
        stripe
        height="100%"
        empty-text="请先导入文档"
      >
```

- [ ] **Step 2: style 增加 flex 布局**

替换 `apps/web/src/modules/knowledge/views/DocumentList.vue` 的 `<style scoped>` 块（345-387 行）为：

```html
<style scoped>
.document-list-page {
  display: flex;
  flex-direction: column;
  height: 100%; /* 填满 main 内容区；底部间隙由 main 的 padding-bottom 提供（py-4=16px / py-3=12px） */
  overflow: hidden;
}
.document-list-page.is-embedded {
  height: auto;
  flex: 1;
  min-height: 0;
}
.page-header {
  margin-bottom: 20px;
  flex-shrink: 0;
}
.page-title {
  font-size: 24px;
  font-weight: 600;
  color: var(--foreground, #303133);
  margin: 0;
}
.upload-section {
  margin-bottom: 24px;
  flex-shrink: 0;
}
.table-section {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: var(--bg-primary, #fff);
  border-radius: 8px;
  padding: 16px;
  border: 1px solid var(--border-color, #ebeef5);
}
.table-section--embedded {
  background: transparent;
  border: none;
  border-radius: 0;
  padding: 0;
}
.table-section :deep(.el-table) {
  flex: 1;
  min-height: 0;
}
.table-pagination {
  flex-shrink: 0;
}
.doc-type-tag {
  font-size: 12px;
  color: var(--foreground-secondary, #606266);
  background: var(--bg-secondary, #f0f2f5);
  padding: 1px 6px;
  border-radius: 4px;
}
/* 操作列按钮间距由容器 gap 控制，覆盖 Element Plus 相邻按钮默认 12px 间距 */
:deep(.operation-cell .el-button + .el-button) {
  margin-left: 0;
}
</style>
```

- [ ] **Step 3: 类型检查 + Commit**

Run: `cd apps/web && npx vue-tsc -b`
Expected: 无类型错误。

```bash
git add apps/web/src/modules/knowledge/views/DocumentList.vue
git commit -m "style(web): DocumentList 表格区 flex 填满 + 内部滚动"
```

---

## Task 5: 布局 — ChunkDetail 表格填满/内部滚动

**Files:**
- Modify: `apps/web/src/modules/knowledge/components/ChunkDetail.vue`

- [ ] **Step 1: 模板调整**

在 `apps/web/src/modules/knowledge/components/ChunkDetail.vue`：
1. 根 div（第 62 行）加 class `chunk-detail-page`。
2. 文档选择器 div（第 63 行）`class="mb-4"` 改为 `class="mb-4 shrink-0"`。
3. el-table（第 70 行）增加 `height="100%"`。
4. 分页 div（第 112 行）`class="flex justify-end mt-4"` 改为 `class="flex justify-end mt-4 shrink-0"`。

- [ ] **Step 2: style 增加 flex 布局**

替换 `<style scoped>` 块为：

```html
<style scoped>
.chunk-detail-page {
  height: 100%;
  display: flex;
  flex-direction: column;
}
.chunk-detail-page :deep(.el-table) {
  flex: 1;
  min-height: 0;
}
.chunk-preview {
  color: var(--foreground, #303133);
  overflow: hidden;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}
</style>
```

- [ ] **Step 3: 类型检查 + Commit**

Run: `cd apps/web && npx vue-tsc -b`
Expected: 无类型错误。

```bash
git add apps/web/src/modules/knowledge/components/ChunkDetail.vue
git commit -m "style(web): ChunkDetail 表格 flex 填满 + 内部滚动"
```

---

## Task 6: 布局 — KnowledgeDetail Tabs 卡片底部填充

**Files:**
- Modify: `apps/web/src/modules/knowledge/views/KnowledgeDetail.vue`

- [ ] **Step 1: 根 div + Header 卡片 + Tabs 卡片 class**

在 `apps/web/src/modules/knowledge/views/KnowledgeDetail.vue`：
1. 根 div（第 109 行 `<div>`）加 class `knowledge-detail-page`。
2. Header 卡片（第 116 行）`<el-card class="mb-2">` 改为 `<el-card class="mb-2 kb-header-card">`。
3. Tabs 卡片（第 158 行）`<el-card>` 改为 `<el-card class="tabs-card">`。

- [ ] **Step 2: 原始文档 pane 填满**

替换 documents tab-pane 内容（原 161-183 行）为：

```html
          <el-tab-pane label="原始文档" name="documents">
            <div class="documents-pane">
              <div class="flex items-center justify-between mb-4 shrink-0">
                <el-button v-if="canUpload" type="primary" :icon="Upload" @click="uploadDialogVisible = true">
                  上传文档
                </el-button>
                <div class="flex items-center gap-2">
                  <el-input
                    v-model="searchQuery"
                    placeholder="搜索文档名称"
                    :prefix-icon="Search"
                    style="width: 220px"
                  />
                </div>
              </div>

              <DocumentList
                :kb-id="kbId"
                embedded
                :can-edit="canEdit"
                @view-chunks="handleViewChunks"
                @embedding="openEmbeddingDialog"
              />
            </div>
          </el-tab-pane>
```

- [ ] **Step 3: 切片 pane 填满**

替换 chunks tab-pane（原 186-192 行）为：

```html
          <el-tab-pane label="切片详情" name="chunks">
            <div class="chunks-pane">
              <ChunkDetail
                :kb-id="kbId"
                :document-id="chunkDocId"
                @update:document-id="chunkDocId = $event"
              />
            </div>
          </el-tab-pane>
```

- [ ] **Step 4: style 增加 flex 布局**

替换 `<style scoped>` 块（251-256 行）为：

```html
<style scoped>
/* 页面 flex 列布局：卡片填满 main 内容区到底部，超出内容表格内部滚动 */
.knowledge-detail-page {
  display: flex;
  flex-direction: column;
  height: 100%; /* 填满 main 内容区；底部间隙由 main 的 padding-bottom 提供（py-4=16px / py-3=12px） */
  overflow: hidden;
}
.kb-header-card {
  flex-shrink: 0;
}
/* Tabs 卡片填满剩余高度，内容内部滚动 */
.tabs-card {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}
.tabs-card :deep(.el-card__body) {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}
.tabs-card :deep(.el-tabs) {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}
.tabs-card :deep(.el-tabs__header) {
  flex-shrink: 0;
}
.tabs-card :deep(.el-tabs__content) {
  flex: 1;
  min-height: 0;
  overflow: hidden;
}
.tabs-card :deep(.el-tab-pane) {
  height: 100%;
  overflow: hidden;
}
.documents-pane,
.chunks-pane {
  height: 100%;
  display: flex;
  flex-direction: column;
}
/* 操作列按钮间距由容器 gap 控制，覆盖 Element Plus 相邻按钮默认 12px 间距 */
:deep(.operation-cell .el-button + .el-button) {
  margin-left: 0;
}
</style>
```

- [ ] **Step 5: 类型检查 + Commit**

Run: `cd apps/web && npx vue-tsc -b`
Expected: 无类型错误。

```bash
git add apps/web/src/modules/knowledge/views/KnowledgeDetail.vue
git commit -m "style(web): KnowledgeDetail Tabs 卡片填满到页面底部12px，表格内部滚动"
```

---

## Task 7: 全量验证

- [ ] **Step 1: 后端全量测试**

Run: `cd apps/api && npx jest --silent`
Expected: 全部 PASS。

- [ ] **Step 2: 前端类型检查**

Run: `cd apps/web && npx vue-tsc -b`
Expected: 无类型错误。

- [ ] **Step 3: 前端构建**

Run: `cd apps/web && npx vite build`
Expected: 构建成功。

- [ ] **Step 4: 手动验证清单**

- 独立文档管理页：表格卡片延伸到页面底部上方约 12px，表格内部滚动（表头固定），分页在底部可见。
- KnowledgeDetail「原始文档」tab：同上；切换「切片详情」tab 时切片表格同样填满滚动。
- 分页切换页/改每页条数能正确请求 `?page=&pageSize=`；删除某页最后一条后自动回退到前一页。
- 上传文档后列表刷新；「切片详情」文档选择器仍显示全部文档（全量查询未受影响）。
