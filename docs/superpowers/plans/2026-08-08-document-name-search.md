# KnowledgeDetail 文档名称搜索 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让 `KnowledgeDetail.vue`「原始文档」标签页已有的「文档名称搜索」输入框生效——按文档名模糊过滤，服务端过滤，与现有服务端分页正确协同。

**Architecture:** 输入框 `searchQuery` 在 `KnowledgeDetail` 做 300ms 防抖后通过 prop 传给 `DocumentList`；`DocumentList` 把 keyword 作为 `usePagedDocuments` 的第 4 参并入 query key，最终以 `GET /documents?keyword=` 请求后端；后端在 `findByKbId` 的 where 上加 `name: { contains, mode: 'insensitive' }` 过滤。后端过滤保证 total/分页反映过滤后结果。

**Tech Stack:** NestJS + Prisma (PostgreSQL) / Vue 3 + @tanstack/vue-query + Element Plus / pnpm monorepo (turbo)。

**Design doc:** `docs/superpowers/specs/2026-08-08-document-name-search-design.md`

**Commits 约定：** 当前工作区干净，HEAD = `abf0e26`（设计提交）。每个任务结束单独提交，message 用中文、前缀 `feat(api)` / `feat(web)`，末尾加 `Co-Authored-By: Claude <noreply@anthropic.com>`。

---

## 文件结构

| 文件 | 动作 | 职责 |
|------|------|------|
| `apps/api/src/modules/knowledge/document/document.service.spec.ts` | 创建（从 git 恢复 + 新增用例） | 分页 + keyword 过滤的单元测试 |
| `apps/api/src/modules/knowledge/document/document.service.ts` | 修改 | `findByKbId` 支持 `keyword` 参数 |
| `apps/api/src/modules/knowledge/document/document.controller.ts` | 修改 | 暴露 `@Query('keyword')` |
| `apps/web/src/modules/knowledge/api/document.api.ts` | 修改 | `listPaged` 透传可选 `keyword` |
| `apps/web/src/modules/knowledge/composables/useDocuments.ts` | 修改 | `usePagedDocuments` 加 keyword 参数 |
| `apps/web/src/modules/knowledge/views/DocumentList.vue` | 修改 | keyword prop + 搜索时回第 1 页 + 动态空文案 |
| `apps/web/src/modules/knowledge/views/KnowledgeDetail.vue` | 修改 | 防抖 + clearable + 传 keyword |

---

### Task 1: 恢复 document.service.spec.ts 并添加失败的 keyword 用例

**Files:**
- Create: `apps/api/src/modules/knowledge/document/document.service.spec.ts`

- [ ] **Step 1: 从 git 恢复分页时代的原始 spec（含 5 个分页用例）**

```bash
git show 7f4609d:apps/api/src/modules/knowledge/document/document.service.spec.ts > apps/api/src/modules/knowledge/document/document.service.spec.ts
```

- [ ] **Step 2: 在 describe 块末尾追加两个 keyword 用例**

打开 `apps/api/src/modules/knowledge/document/document.service.spec.ts`，在最后一个用例 `pageSize 下界归一化...` 的 `});` 之后、describe 的收尾 `});` 之前插入：

```ts
  it('传 keyword → where 含 name 模糊过滤（contains + insensitive）', async () => {
    prisma.document.count.mockResolvedValue(0);
    prisma.document.findMany.mockResolvedValue([]);
    await service.findByKbId('kb1', {
      page: 1,
      pageSize: 20,
      keyword: '系统需求',
    });
    expect(prisma.document.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          kbId: 'kb1',
          name: { contains: '系统需求', mode: 'insensitive' },
        }),
      }),
    );
  });

  it('空白 keyword → where 不含 name 过滤条件', async () => {
    prisma.document.count.mockResolvedValue(0);
    prisma.document.findMany.mockResolvedValue([]);
    await service.findByKbId('kb1', {
      page: 1,
      pageSize: 20,
      keyword: '   ',
    });
    const findManyArg = prisma.document.findMany.mock.calls[0][0];
    expect(findManyArg.where).not.toHaveProperty('name');
  });
```

- [ ] **Step 3: 运行测试确认失败**

```bash
pnpm --filter @nexus/api test document.service.spec.ts
```

Expected: 5 个分页用例 PASS；新用例「传 keyword → where 含 name…」FAIL（当前 service 忽略 keyword，where 无 `name`）；「空白 keyword → where 不含 name」PASS（回归护栏）。

---

### Task 2: service 实现 keyword 过滤

**Files:**
- Modify: `apps/api/src/modules/knowledge/document/document.service.ts`（`findByKbId`，约 186-195 行）

- [ ] **Step 1: 扩展 params 类型并加入 name 过滤**

将 `findByKbId` 签名与 where 构造替换为：

```ts
  async findByKbId(
    kbId: string,
    params?: {
      status?: DocumentStatus;
      page?: number;
      pageSize?: number;
      keyword?: string;
    },
  ) {
    const keyword = params?.keyword?.trim();
    const where: Prisma.DocumentWhereInput = {
      kbId,
      ...(params?.status
        ? { status: params.status }
        : { status: { not: 'DELETED' } }),
      ...(keyword ? { name: { contains: keyword, mode: 'insensitive' } } : {}),
    };
```

- [ ] **Step 2: 运行测试确认全绿**

```bash
pnpm --filter @nexus/api test document.service.spec.ts
```

Expected: 7 个用例全部 PASS。

- [ ] **Step 3: 提交**

```bash
git add apps/api/src/modules/knowledge/document/document.service.spec.ts apps/api/src/modules/knowledge/document/document.service.ts
git commit -m "feat(api): 文档列表支持 keyword 文档名模糊过滤

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 3: controller 暴露 keyword query 参数

**Files:**
- Modify: `apps/api/src/modules/knowledge/document/document.controller.ts`（`findByKbId`，约 59-76 行）

- [ ] **Step 1: 增加 @Query('keyword')**

将 `findByKbId` 的参数列表与 service 调用改为：

```ts
  async findByKbId(
    @Param('kbId') kbId: string,
    @Query('status') status?: string,
    @Query('page', new ParseIntPipe({ optional: true })) page?: number,
    @Query('pageSize', new ParseIntPipe({ optional: true })) pageSize?: number,
    @Query('keyword') keyword?: string,
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
      keyword,
    });
  }
```

- [ ] **Step 2: 构建验证类型正确**

```bash
pnpm --filter @nexus/api build
```

Expected: 构建成功，无 TS 错误。

- [ ] **Step 3: 提交**

```bash
git add apps/api/src/modules/knowledge/document/document.controller.ts
git commit -m "feat(api): 文档列表接口透传 keyword 查询参数

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 4: 前端 api + composable 打通 keyword

**Files:**
- Modify: `apps/web/src/modules/knowledge/api/document.api.ts`（`listPaged`，约 19-20 行）
- Modify: `apps/web/src/modules/knowledge/composables/useDocuments.ts`（`usePagedDocuments`，约 21-36 行）

- [ ] **Step 1: listPaged 加可选 keyword**

```ts
  /** 分页查询文档列表 */
  listPaged: (kbId: string, params: { page: number; pageSize: number; keyword?: string }) =>
    http.get<DocumentListResponse>(`/knowledge-bases/${kbId}/documents`, { params }),
```

- [ ] **Step 2: usePagedDocuments 加第 4 参 keyword**

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

- [ ] **Step 3: 类型检查**

```bash
pnpm --filter @nexus/web-v2 check-types
```

Expected: 通过，无 TS 错误。

- [ ] **Step 4: 提交**

```bash
git add apps/web/src/modules/knowledge/api/document.api.ts apps/web/src/modules/knowledge/composables/useDocuments.ts
git commit -m "feat(web): usePagedDocuments/listPaged 支持 keyword 过滤

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 5: DocumentList 接入 keyword

**Files:**
- Modify: `apps/web/src/modules/knowledge/views/DocumentList.vue`

- [ ] **Step 1: props 增加 keyword**

```ts
const props = defineProps<{
  /** 知识库 ID；未传时回退到路由 query.kbId（独立"文档管理"页） */
  kbId?: string
  /** 嵌入到知识库详情时：隐藏页头/上传区，显示 切片详情/Embedding 操作 */
  embedded?: boolean
  /** 编辑权限（admin），控制 Embedding 按钮显示 */
  canEdit?: boolean
  /** 文档名称搜索关键字（服务端模糊过滤）；变化时回到第 1 页 */
  keyword?: string
}>()
```

- [ ] **Step 2: 传给 usePagedDocuments + 搜索变化回第 1 页 + 动态空文案**

将 `usePagedDocuments` 调用（约 32 行）改为：

```ts
const { data: docData, isLoading, refetch } = usePagedDocuments(
  kbId,
  page,
  pageSize,
  () => props.keyword || '',
)
```

在已有的 `watch(total, ...)`（约 36-39 行）之后新增：

```ts
// 搜索词变化 → 回到第 1 页，避免停在旧页码看到空白页
watch(() => props.keyword, () => {
  page.value = 1
})

// 空状态文案：无搜索词 → "请先导入文档"；有搜索词无结果 → "未找到匹配的文档"
const emptyText = computed(() =>
  (props.keyword || '').trim() ? '未找到匹配的文档' : '请先导入文档',
)
```

将 el-table 的 `empty-text="请先导入文档"`（约 185 行）改为 `:empty-text="emptyText"`。

- [ ] **Step 3: 类型检查**

```bash
pnpm --filter @nexus/web-v2 check-types
```

Expected: 通过。

- [ ] **Step 4: 提交**

```bash
git add apps/web/src/modules/knowledge/views/DocumentList.vue
git commit -m "feat(web): DocumentList 接入文档名搜索（keyword prop + 回首页 + 空文案）

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 6: KnowledgeDetail 防抖 + 接线

**Files:**
- Modify: `apps/web/src/modules/knowledge/views/KnowledgeDetail.vue`

- [ ] **Step 1: searchQuery 后加防抖逻辑**

将（约 46 行）：

```ts
const searchQuery = ref('')
```

替换为：

```ts
const searchQuery = ref('')
// 文档名称搜索：300ms 防抖 + trim，避免每敲一个字符都发请求
const debouncedQuery = ref('')
let searchTimer: ReturnType<typeof setTimeout> | undefined
watch(searchQuery, (val) => {
  clearTimeout(searchTimer)
  searchTimer = setTimeout(() => {
    debouncedQuery.value = val.trim()
  }, 300)
})
```

- [ ] **Step 2: 输入框加 clearable、DocumentList 传 keyword**

输入框（约 167-172 行）改为：

```html
<el-input
  v-model="searchQuery"
  placeholder="文档名称搜索"
  :prefix-icon="Search"
  clearable
  style="width: 220px"
/>
```

`<DocumentList ...>`（约 176-182 行）加 `:keyword="debouncedQuery"`：

```html
<DocumentList
  :kb-id="kbId"
  embedded
  :can-edit="canEdit"
  :keyword="debouncedQuery"
  @view-chunks="handleViewChunks"
  @embedding="openEmbeddingDialog"
/>
```

- [ ] **Step 3: 类型检查**

```bash
pnpm --filter @nexus/web-v2 check-types
```

Expected: 通过。

- [ ] **Step 4: 提交**

```bash
git add apps/web/src/modules/knowledge/views/KnowledgeDetail.vue
git commit -m "feat(web): KnowledgeDetail 文档名称搜索 300ms 防抖接线

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 7: 全量验证

**Files:** 无改动

- [ ] **Step 1: 后端测试全绿**

```bash
pnpm --filter @nexus/api test
```

Expected: 全部通过（含 document.service.spec.ts 的 7 个用例）。

- [ ] **Step 2: 前端类型检查 + 构建**

```bash
pnpm --filter @nexus/web-v2 check-types
pnpm --filter @nexus/web-v2 build
```

Expected: 均成功。

- [ ] **Step 3: 手动 E2E（无法自动化的部分）**

1. `pnpm --filter @nexus/web-v2 dev`（vite，端口 3034）+ 后端 dev 起服务。
2. 进入某知识库详情 →「原始文档」标签页。
3. 在搜索框输入不存在的名称（如 `zzzz`）→ 停顿 300ms 后表格显示"未找到匹配的文档"，分页条隐藏。
4. 输入已有文档名的一部分（如 `系统`）→ 表格仅显示匹配文档，total 变为过滤后数量。
5. 点输入框清空按钮 → 恢复全量列表。
6. 输入中文（如 `需求`）与英文大写（如 `ABC` vs `abc`）→ 均能匹配（大小写不敏感）。

---

## 已确认不做的（范围外）

- 独立「文档管理」页（`/knowledge-bases/documents`）不加搜索框。
- 不恢复 `chunk.service.spec.ts`。
- 不引入防抖第三方依赖。
