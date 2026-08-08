# DocumentList 分页 + 列表页底部填充布局

日期：2026-08-08
状态：已批准（用户确认设计）

## 目标

1. `DocumentList` 增加服务端分页，使用 `el-pagination` 组件；对应后端接口 `GET /knowledge-bases/:kbId/documents` 支持分页。
2. `KnowledgeDetail.vue` 与独立「文档管理」页（`/knowledge-bases/documents`）的列表卡片高度延伸到页面底部上方 12px，超出内容在表格内部滚动。

## 范围

- 后端：`document.controller.ts`、`document.service.ts`、新增 `document.service.spec.ts`。
- 前端：`types/document.ts`、`api/document.api.ts`、`composables/useDocuments.ts`、`views/DocumentList.vue`、`views/KnowledgeDetail.vue`、`components/ChunkDetail.vue`（切片 pane 填满所需的最小改动）。
- 明确不做：`KnowledgeDetail` 中当前无功能的 `searchQuery` 搜索框（保持原样，本次只做分页）。

## 1. 分页

### 后端

`DocumentService.findByKbId(kbId, params)`：

- `params` 扩展为 `{ status?: DocumentStatus; page?: number; pageSize?: number }`。
- **提供 `page`/`pageSize` 时**：在事务内 `count` + `findMany`（`skip`/`take`），返回
  `{ items, total, page, pageSize }`。
  - page 默认 1；pageSize 默认 20、上限 100（与 `ChunkService.listChunks` 口径一致）。
- **不提供分页参数时**：保持返回完整数组（向后兼容，供 `ChunkDetail` 文档选择器与 `DocumentUpload` 版本分组使用全量数据）。

`DocumentController.findByKbId` 增加 query 参数：

- `@Query('page', new ParseIntPipe({ optional: true })) page?: number`
- `@Query('pageSize', new ParseIntPipe({ optional: true })) pageSize?: number`

新增 `document.service.spec.ts`（沿用 `chunk.service.spec.ts` 的 mock 模式）：

- 提供分页参数 → 调用 `count` + `findMany`，断言 `skip`/`take`，返回 envelope。
- 默认值：page=1、pageSize=20；pageSize 上限 100。
- 不提供分页参数 → 返回完整数组、不调用 `count`。
- 非法/缺失状态参数行为保持不变。

### 前端

`types/document.ts`：

```ts
export interface DocumentListResponse {
  items: Document[]
  total: number
  page: number
  pageSize: number
}
```

`api/document.api.ts`：

- `list`（全量，`Document[]`）保持不变 —— 供 `ChunkDetail`/`DocumentUpload`。
- 新增 `listPaged(kbId, { page, pageSize })` → `DocumentListResponse`，请求 `/documents?page=&pageSize=`。

`composables/useDocuments.ts`：

- `useDocuments`（全量）保持不变。
- 新增 `usePagedDocuments(kbId, page, pageSize)`：

```ts
export function usePagedDocuments(kbId, page, pageSize) {
  return useQuery({
    queryKey: ['documents', kbId, 'paged', page, pageSize],
    queryFn: () => documentsApi.listPaged(toValue(kbId), {
      page: toValue(page), pageSize: toValue(pageSize),
    }),
    enabled: () => !!toValue(kbId),
  })
}
```

- 现有 mutation 的 `invalidateQueries({ queryKey: ['documents', variables.kbId] })` 通过前缀匹配自动刷新分页列表，无需改动。

`views/DocumentList.vue`：

- 改用 `usePagedDocuments(kbId, page, pageSize)`（`page = ref(1)`、`pageSize = ref(20)`）。
- `docsList` 改为 `(data.value?.items ?? []).map(...)`。
- 表格下方新增 `el-pagination`：

```html
<el-pagination
  v-model:current-page="page"
  v-model:page-size="pageSize"
  :total="total"
  :page-sizes="[20, 50, 100]"
  layout="total, sizes, prev, pager, next, jumper"
/>
```

- 删除后当前页可能越界：`watch(total)` 修正 `page`（`page > maxPage` 时回退）。

## 2. 布局（KnowledgeDetail + 独立 Documents 页）

### 高度计算

- `MainLayout`：`main` 为 `flex-1 overflow-y-auto px-5 py-4`（未提交的进行中改动为 `px-3 py-3`）。
- 页面根节点高度：`height: 100%`（填满 `main` 内容区）+ `overflow: hidden`；卡片底部间隙由 `main` 的 padding-bottom 提供（py-4=16px / py-3=12px）。不硬编码页头/padding 常量，对 `MainLayout` 改动健壮。

### KnowledgeDetail.vue

- 根 div：`display:flex; flex-direction:column; height:calc(100vh - 84px); overflow:hidden`。
- Header 卡片：`shrink-0`。
- Tabs 卡片（`el-card`）：`flex:1; min-height:0`，逐层：

```
.tabs-card { display:flex; flex-direction:column; flex:1; min-height:0; }
.tabs-card :deep(.el-card__body)  { flex:1; min-height:0; display:flex; flex-direction:column; }
.tabs-card :deep(.el-tabs)        { flex:1; min-height:0; display:flex; flex-direction:column; }
.tabs-card :deep(.el-tabs__header) { flex-shrink:0; }
.tabs-card :deep(.el-tabs__content){ flex:1; min-height:0; overflow:hidden; }
.tabs-card :deep(.el-tab-pane)     { height:100%; overflow:hidden; }
```

- 原始文档 pane：外层 `h-full flex flex-col`，工具栏 `shrink-0`，`DocumentList` 填满剩余。
- 切片 pane：外层 `h-full flex flex-col`，`ChunkDetail` 填满。

### DocumentList.vue

- 独立页根节点：`display:flex; flex-direction:column; height:calc(100vh - 84px); overflow:hidden`。
- 嵌入模式根节点：`height:100%`（高度由 KnowledgeDetail flex 链提供）。
- 页头 / 上传区：`shrink-0`。
- `.table-section`：`flex:1; min-height:0; display:flex; flex-direction:column; overflow:hidden`；`el-table` `height="100%"` 内部滚动（表头固定），`el-pagination` 在表格下方 `shrink-0`，始终可见。

### ChunkDetail.vue

- 根 div：`height:100%; display:flex; flex-direction:column`。
- 文档选择器 `shrink-0`；`el-table` `height="100%"`；分页 `shrink-0`（已有）。

### Fallback

若 `el-table height="100%"` 在实测中出现不填满/不滚动，退化为：表格外层包 `flex:1; min-height:0; overflow:auto` 滚动容器。

## 风险与影响

- `useDocuments` 全量查询保持不动，`ChunkDetail` / `DocumentUpload` 零回归。
- 后端接口向后兼容（无分页参数返回数组）。
- 硬编码 `calc(100vh - 84px)` 依赖当前页头 56px + main 顶部 padding 16px；若布局变量变化需同步调整。
