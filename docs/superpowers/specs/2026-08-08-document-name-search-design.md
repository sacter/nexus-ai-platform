# KnowledgeDetail 文档名称搜索

日期：2026-08-08
状态：已批准（用户确认设计；测试项确认恢复 spec 并补 keyword 用例）

## 目标

让 `KnowledgeDetail.vue`「原始文档」标签页中已存在但无功能的「文档名称搜索」输入框真正生效：按文档名模糊过滤，服务端过滤，与已有的服务端分页正确协同。

## 范围

- 后端：`document.controller.ts`、`document.service.ts`、恢复 `document.service.spec.ts` 并新增 keyword 用例。
- 前端：`api/document.api.ts`、`composables/useDocuments.ts`、`views/DocumentList.vue`、`views/KnowledgeDetail.vue`。
- 明确不做：
  - 独立「文档管理」页（`/knowledge-bases/documents`，非 embedded 的 `DocumentList`）不加搜索框。
  - 不恢复已删除的 `chunk.service.spec.ts`（不在本次范围）。
  - 不引入防抖依赖，用原生 `setTimeout`。

## 数据流

```
searchQuery(输入) --300ms 防抖 + trim--> debouncedQuery
  → <DocumentList :keyword="debouncedQuery">
  → usePagedDocuments(kbId, page, pageSize, keyword)
  → listPaged({ page, pageSize, keyword })
  → GET /knowledge-bases/:kbId/documents?keyword=xxx
  → findByKbId where.name: { contains, mode: 'insensitive' }
```

## 1. 后端

### document.service.ts — findByKbId

- `params` 类型扩展为 `{ status?: DocumentStatus; page?: number; pageSize?: number; keyword?: string }`。
- 关键过滤：

```ts
const keyword = params?.keyword?.trim();
const where: Prisma.DocumentWhereInput = {
  kbId,
  ...(params?.status
    ? { status: params.status }
    : { status: { not: 'DELETED' } }),
  ...(keyword ? { name: { contains: keyword, mode: 'insensitive' } } : {}),
};
```

- `trim` 后空串不产生过滤条件（避免 `contains: ''` 匹配全部、纯空格误过滤）。
- `mode: 'insensitive'` 为 PostgreSQL 大小写不敏感匹配；中文天然不受影响。
- 分页/全量双模式逻辑不变：`keyword` 只影响 where，不影响返回形状。

### document.controller.ts — findByKbId

- 增加 `@Query('keyword') keyword?: string`，透传给 service。

### document.service.spec.ts（恢复 + 新增用例）

- 从 git 恢复原分页用例（`7f4609d` 版本：全量/分页/single-param/归一化四个用例），沿用 chunk mock 模式（`jest.clearAllMocks()`、顺序执行事务 mock）。
- 新增用例：
  1. 传 `keyword` → `findMany` 断言 where 含 `name: { contains, mode: 'insensitive' }`。
  2. 传空白/仅空格 `keyword` → where 不含 name 过滤条件（等效全量）。

## 2. 前端

### api/document.api.ts

```ts
listPaged: (kbId: string, params: { page: number; pageSize: number; keyword?: string }) =>
```

仅加可选 `keyword`，向后兼容。

### composables/useDocuments.ts

```ts
export function usePagedDocuments(
  kbId: MaybeRefOrGetter<string>,
  page: MaybeRefOrGetter<number>,
  pageSize: MaybeRefOrGetter<number>,
  keyword: MaybeRefOrGetter<string> = '',
) {
  return useQuery({
    queryKey: ['documents', kbId, 'paged', page, pageSize, keyword],
    queryFn: () =>
      documentsApi.listPaged(toValue(kbId), {
        page: toValue(page),
        pageSize: toValue(pageSize),
        ...(toValue(keyword) ? { keyword: toValue(keyword) } : {}),
      }),
    enabled: () => !!toValue(kbId),
    placeholderData: (prev) => prev,
  })
}
```

- `keyword` 进 query key → 搜索词变化自动 refetch。
- 现有 mutation 的 `invalidateQueries({ queryKey: ['documents', kbId] })` 前缀匹配自动覆盖分页列表，无需改动。

### views/DocumentList.vue

- 新增 prop `keyword?: string`。
- `usePagedDocuments(kbId, page, pageSize, () => props.keyword || '')`。
- 新增 watch：`() => props.keyword` 变化时 `page.value = 1`（避免搜索后停在旧页码看到空白页）。

### views/KnowledgeDetail.vue

- 输入框加 `clearable`（清空即恢复全量）。
- `searchQuery` → `debouncedQuery`（300ms `setTimeout` 防抖 + `trim`）：

```ts
const debouncedQuery = ref('')
let timer: ReturnType<typeof setTimeout> | undefined
watch(searchQuery, (val) => {
  clearTimeout(timer)
  timer = setTimeout(() => { debouncedQuery.value = val.trim() }, 300)
})
```

- `<DocumentList :keyword="debouncedQuery" ... />`。
- 表格无数据文案区分：无文档 → "请先导入文档"；有搜索词且无匹配 → "未找到匹配的文档"。实现：`DocumentList` 内 `emptyText` 按 `props.keyword` 与 `total` 计算。

## 边界行为

- 清空搜索 → `debouncedQuery` 变 `''` → 无过滤 → 回到全量列表。
- 搜索无结果 → 空文案显示"未找到匹配的文档"。
- 搜索后删除/刷新导致当前页越界：已有 `watch(total)` 回退逻辑覆盖。

## 风险与影响

- 后端接口向后兼容：`keyword` 可选，缺省行为完全不变；全量/分页双模式契约不变。
- 独立「文档管理」页不传 `keyword` prop，零影响。
- 防抖纯前端 `setTimeout`，无新增依赖。
- 恢复 `document.service.spec.ts` 只是还原被删除的工作区文件 + 新增用例，不影响其他模块。
