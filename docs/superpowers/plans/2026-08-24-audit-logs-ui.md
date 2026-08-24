# Audit Logs 前端页面 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将 `/audit-logs` 从最小表格升级为可筛选、可分页、可追溯的审计日志治理页面，并接入真实分页 API。

**Architecture:** 保留现有 `system` 模块边界。用类型化的 `audit-logs.api.ts` 和 `useAuditLogs.ts` 隔离请求与服务端状态，`AuditLogs.vue` 只负责筛选、分页、详情抽屉和展示。API 使用相对 `/audit-logs` 路径以复用 Axios 全局 `/api/v1` 前缀，并通过纯函数规范化分页对象/数组响应。

**Tech Stack:** Vue 3 Composition API、TypeScript、TanStack Query Vue 5、Element Plus、Vitest、Vue Test Utils、Tailwind CSS 4、dayjs。

---

## 文件地图

- Modify: `apps/web/src/modules/system/types/audit-log.ts` — 审计动作、实体、记录和分页查询类型，提供显示/格式化辅助函数。
- Modify: `apps/web/src/modules/system/api/audit-logs.api.ts` — 类型化列表请求，修正双重 `/api/v1` 前缀。
- Create: `apps/web/src/modules/system/composables/useAuditLogs.ts` — TanStack Query 查询封装。
- Create: `apps/web/src/modules/system/utils/audit-log-display.ts` — 动作/实体显示名、标签类型、详情 JSON 和响应规范化纯函数。
- Modify: `apps/web/src/modules/system/views/AuditLogs.vue` — 页面完整交互和响应式视觉实现。
- Create: `apps/web/src/modules/system/__tests__/audit-log-display.spec.ts` — 纯函数行为测试。
- Create: `apps/web/src/modules/system/__tests__/AuditLogs.spec.ts` — 页面筛选、空状态和详情抽屉测试。

---

### Task 1: 定义审计日志领域类型和纯函数

**Files:**
- Modify: `apps/web/src/modules/system/types/audit-log.ts`
- Create: `apps/web/src/modules/system/utils/audit-log-display.ts`
- Test: `apps/web/src/modules/system/__tests__/audit-log-display.spec.ts`

- [ ] **Step 1: Write the failing tests**

在 `audit-log-display.spec.ts` 写下列行为测试，先导入尚不存在的函数：

```ts
import { describe, expect, it } from 'vitest'
import type { AuditLog } from '@/modules/system/types/audit-log'
import {
  formatAuditDetails,
  normalizeAuditLogResponse,
  auditActionLabel,
  auditActionTagType,
  entityTypeLabel,
} from '@/modules/system/utils/audit-log-display'

const baseLog: AuditLog = {
  id: 'log-1',
  userId: 'user-1',
  username: 'zhang',
  action: 'DOCUMENT_UPLOAD',
  entityType: 'document',
  entityId: 'doc-1',
  kbId: 'kb-1',
  kbName: 'HR 知识库',
  details: { fileName: '员工手册.pdf', version: 3 },
  ipAddress: '10.0.0.8',
  createdAt: '2026-08-24T10:30:00.000Z',
}

describe('audit log display helpers', () => {
  it('maps known and unknown actions without hiding the raw value', () => {
    expect(auditActionLabel('DOCUMENT_UPLOAD')).toBe('上传文档')
    expect(auditActionLabel('UNKNOWN_ACTION')).toBe('UNKNOWN_ACTION')
    expect(auditActionTagType('DOCUMENT_DELETE')).toBe('danger')
  })

  it('maps entity types and keeps unknown types readable', () => {
    expect(entityTypeLabel('knowledge_base')).toBe('知识库')
    expect(entityTypeLabel('custom_entity')).toBe('custom_entity')
  })

  it('formats JSON details and empty details safely', () => {
    expect(formatAuditDetails(baseLog.details)).toContain('员工手册.pdf')
    expect(formatAuditDetails(null)).toBe('--')
  })

  it('normalizes paginated and legacy array responses', () => {
    expect(normalizeAuditLogResponse({ items: [baseLog], total: 12, page: 2, pageSize: 10 })).toEqual({
      items: [baseLog], total: 12, page: 2, pageSize: 10,
    })
    expect(normalizeAuditLogResponse([baseLog])).toEqual({
      items: [baseLog], total: 1, page: 1, pageSize: 10,
    })
  })
})
```

- [ ] **Step 2: Run the focused test to verify it fails**

Run: `pnpm --dir apps/web exec vitest run src/modules/system/__tests__/audit-log-display.spec.ts`

Expected: FAIL because `audit-log-display` and the expanded `AuditLog` contract do not exist.

- [ ] **Step 3: Add the minimal types and implementations**

Update `audit-log.ts` with:

```ts
export type AuditAction =
  | 'DOCUMENT_UPLOAD' | 'DOCUMENT_DELETE' | 'DOCUMENT_REINDEX'
  | 'KB_CREATE' | 'KB_DELETE' | 'KB_UPDATE' | 'PERMISSION_CHANGE'
  | 'SETTING_CHANGE' | 'API_KEY_CREATE' | 'API_KEY_DELETE'
  | 'PROMPT_CREATE' | 'PROMPT_UPDATE' | 'USER_LOGIN' | 'VERSION_ACTIVATE'
  | 'AI_APP_CREATE' | 'AI_APP_DELETE' | 'AI_APP_UPDATE'
  | 'MODEL_REGISTER' | 'MODEL_DELETE'
  | 'WORKFLOW_CREATE' | 'WORKFLOW_UPDATE' | 'WORKFLOW_EXECUTE'
  | 'TOOL_REGISTER' | 'TOOL_DELETE' | 'TOOL_EXECUTE' | 'CHAT_FEEDBACK'
  | string

export interface AuditLog {
  id: string
  userId: string | null
  username?: string | null
  action: AuditAction
  entityType: string
  entityId: string | null
  kbId: string | null
  kbName?: string | null
  details: Record<string, unknown> | string | null
  ipAddress: string | null
  createdAt: string
}

export interface AuditLogListParams {
  page?: number
  pageSize?: number
  keyword?: string
  user?: string
  action?: string
  entityType?: string
  kbId?: string
  startDate?: string
  endDate?: string
}

export interface AuditLogListResponse {
  items: AuditLog[]
  total: number
  page: number
  pageSize: number
}

export type AuditLogApiResponse = AuditLogListResponse | AuditLog[]
```

Implement `audit-log-display.ts` with maps for all enum values in the schema, fallback raw values, action tag types (`danger` for delete, `warning` for permission/setting, `success` for create/upload, `info` otherwise), `formatAuditDetails`, and `normalizeAuditLogResponse` exactly matching the tests. `formatAuditDetails` must catch JSON serialization errors and return `--` for null/undefined/empty objects only when no meaningful value exists.

- [ ] **Step 4: Run the focused test to verify it passes**

Run: `pnpm --dir apps/web exec vitest run src/modules/system/__tests__/audit-log-display.spec.ts`

Expected: PASS.

- [ ] **Step 5: Commit the domain contract**

```bash
git add apps/web/src/modules/system/types/audit-log.ts apps/web/src/modules/system/utils/audit-log-display.ts apps/web/src/modules/system/__tests__/audit-log-display.spec.ts
git commit -m "feat(web): add audit log display contract"
```

---

### Task 2: Add typed API and TanStack Query composable

**Files:**
- Modify: `apps/web/src/modules/system/api/audit-logs.api.ts`
- Create: `apps/web/src/modules/system/composables/useAuditLogs.ts`
- Modify: `apps/web/src/modules/system/__tests__/audit-log-display.spec.ts` only if shared request type tests are needed

- [ ] **Step 1: Write the failing API contract test**

Add a test to a new `apps/web/src/modules/system/__tests__/audit-logs.api.spec.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { auditLogsApi } from '@/modules/system/api/audit-logs.api'
import http from '@/api/client'

vi.mock('@/api/client', () => ({ default: { get: vi.fn() } }))

describe('auditLogsApi', () => {
  beforeEach(() => vi.clearAllMocks())

  it('requests the relative endpoint and forwards filters', async () => {
    vi.mocked(http.get).mockResolvedValue({ items: [], total: 0, page: 1, pageSize: 20 })
    const params = { page: 2, pageSize: 20, action: 'DOCUMENT_UPLOAD', startDate: '2026-08-01' }
    await auditLogsApi.list(params)
    expect(http.get).toHaveBeenCalledWith('/audit-logs', { params })
  })
})
```

- [ ] **Step 2: Run the API test to verify it fails**

Run: `pnpm --dir apps/web exec vitest run src/modules/system/__tests__/audit-logs.api.spec.ts`

Expected: FAIL because the current API calls `/api/v1/audit-logs` and has no typed contract.

- [ ] **Step 3: Implement the API and composable**

`audit-logs.api.ts` should be:

```ts
import http from '@/api/client'
import type { AuditLogListParams, AuditLogApiResponse } from '../types/audit-log'

export const auditLogsApi = {
  list: (params?: AuditLogListParams) =>
    http.get<AuditLogApiResponse>('/audit-logs', { params }),
}
```

`useAuditLogs.ts` should expose:

```ts
import { useQuery } from '@tanstack/vue-query'
import { toValue, type MaybeRef } from 'vue'
import { auditLogsApi } from '@/modules/system/api/audit-logs.api'
import { normalizeAuditLogResponse } from '@/modules/system/utils/audit-log-display'
import type { AuditLogListParams } from '@/modules/system/types/audit-log'

export function useAuditLogs(params: MaybeRef<AuditLogListParams>) {
  return useQuery({
    queryKey: ['audit-logs', params],
    queryFn: async () => normalizeAuditLogResponse(await auditLogsApi.list(toValue(params))),
    placeholderData: (previousData) => previousData,
  })
}
```

Do not add polling. The page will call `refetch()` from the refresh control.

- [ ] **Step 4: Run API and type checks**

Run: `pnpm --dir apps/web exec vitest run src/modules/system/__tests__/audit-logs.api.spec.ts && pnpm --dir apps/web run check-types`

Expected: PASS and no TypeScript errors.

- [ ] **Step 5: Commit the request layer**

```bash
git add apps/web/src/modules/system/api/audit-logs.api.ts apps/web/src/modules/system/composables/useAuditLogs.ts apps/web/src/modules/system/__tests__/audit-logs.api.spec.ts
git commit -m "feat(web): connect audit log query API"
```

---

### Task 3: Build the audit logs page shell and filter state

**Files:**
- Modify: `apps/web/src/modules/system/views/AuditLogs.vue`
- Create: `apps/web/src/modules/system/__tests__/AuditLogs.spec.ts`

- [ ] **Step 1: Write failing component tests**

Create a mount helper that stubs `useAuditLogs`, Element Plus table/select/date-picker/drawer primitives as needed, then add these tests:

```ts
it('resets to the first page when a filter changes', async () => {
  const wrapper = mountAuditLogs({ items: [makeLog()] })
  await wrapper.find('[data-test="keyword-filter"] input').setValue('zhang')
  expect(wrapper.find('[data-test="page-value"]').text()).toContain('1')
})

it('shows an actionable empty state when filters match nothing', () => {
  const wrapper = mountAuditLogs({ items: [], total: 0 })
  expect(wrapper.text()).toContain('暂无审计记录')
})

it('opens the detail drawer for a selected log', async () => {
  const wrapper = mountAuditLogs({ items: [makeLog()] })
  await wrapper.find('[data-test="view-log"]').trigger('click')
  expect(wrapper.text()).toContain('员工手册.pdf')
  expect(wrapper.text()).toContain('日志详情')
})
```

The test must fail because the current page has no filter controls, data attributes, empty state, or drawer.

- [ ] **Step 2: Run the component tests to verify they fail**

Run: `pnpm --dir apps/web exec vitest run src/modules/system/__tests__/AuditLogs.spec.ts`

Expected: FAIL with missing selectors/content.

- [ ] **Step 3: Implement script state and helpers in `AuditLogs.vue`**

Use `reactive` filters with `keyword`, `user`, `action`, `entityType`, `kbId`, `dateRange`; `page` default 1, `pageSize` default 20, `detailVisible`, `selectedLog`. Build computed params that omit empty values and convert date range to `startDate`/`endDate` using `dayjs(...).startOf('day')` and `endOf('day')` formatted as ISO strings. Watch all filters and reset page to 1. Use `useAuditLogs(params)`, `logs`, `total`, `latestActivity`, `hasFilters`, `resetFilters`, `openDetail`, `copyValue`, and `refetch`.

Use explicit error handling around clipboard and let the query error render an `el-alert` with a refresh button; do not swallow query state.

- [ ] **Step 4: Implement the page template shell**

Replace the current template with:

- Header using `Lock`, `Refresh`, title and description.
- Three summary blocks: `total`, `logs.length`, and `latestActivity`.
- Filter controls with `data-test="keyword-filter"`, action/entity/KB selects, date range picker, reset button and result count.
- `el-skeleton` during initial load.
- Error alert when `isError`.
- Desktop `el-table` with columns time, user, action, target, KB, IP and detail action; detail action has `data-test="view-log"`.
- Empty state with distinct copy for filtered/unfiltered results.
- Pagination with a `data-test="page-value"` marker bound to current page.
- `el-drawer` containing structured metadata and `<pre>` JSON details, plus copy buttons.
- Mobile event list rendered from the same `logs` collection under a responsive class, not a second data source.

Use `auditActionLabel`, `auditActionTagType`, `entityTypeLabel` and `formatAuditDetails` for all user-facing mappings. Unknown values must remain visible.

- [ ] **Step 5: Run component tests to verify they pass**

Run: `pnpm --dir apps/web exec vitest run src/modules/system/__tests__/AuditLogs.spec.ts`

Expected: PASS.

- [ ] **Step 6: Commit the page behavior**

```bash
git add apps/web/src/modules/system/views/AuditLogs.vue apps/web/src/modules/system/__tests__/AuditLogs.spec.ts
git commit -m "feat(web): build audit logs governance page"
```

---

### Task 4: Apply responsive visual treatment and accessibility details

**Files:**
- Modify: `apps/web/src/modules/system/views/AuditLogs.vue`
- Modify: `apps/web/src/modules/system/__tests__/AuditLogs.spec.ts`

- [ ] **Step 1: Add failing accessibility assertions**

Add tests that assert refresh and copy controls expose accessible labels, and filtered empty state exposes a reset action:

```ts
it('labels icon-only controls and offers reset from filtered empty state', () => {
  const wrapper = mountAuditLogs({ items: [], total: 0, keyword: 'missing' })
  expect(wrapper.find('[aria-label="刷新审计日志"]').exists()).toBe(true)
  expect(wrapper.find('[aria-label="复制日志 ID"]').exists()).toBe(true)
  expect(wrapper.text()).toContain('清空筛选')
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm --dir apps/web exec vitest run src/modules/system/__tests__/AuditLogs.spec.ts`

Expected: FAIL until labels and the filtered empty action are present.

- [ ] **Step 3: Add scoped CSS and accessible controls**

Add scoped styles matching existing JobList conventions:

- `.audit-page` uses `--track`, `--event-line`, and theme-derived colors only.
- Header mark uses `var(--brand-gradient)`.
- Summary blocks use `var(--surface)`, `var(--border)`, and max 10px radius.
- `.audit-event` uses a vertical line and node for the time column; hide the line only at mobile widths where the compact card replaces it.
- Table target cell includes readable name and monospace ID.
- Details `<pre>` gets overflow scrolling, `white-space: pre-wrap`, and word breaking.
- Add `@media (max-width: 640px)` to hide desktop table and show `.audit-mobile-list`; add `@media (min-width: 641px)` for the inverse.
- Keep focus-visible outlines on custom buttons and use existing reduced-motion behavior.

Add `aria-label="刷新审计日志"`, `aria-label="复制日志 ID"`, `aria-label="复制实体 ID"`, and equivalent labels for other icon-only controls. Keep text labels on non-icon command buttons.

- [ ] **Step 4: Run component tests and lint**

Run: `pnpm --dir apps/web exec vitest run src/modules/system/__tests__/AuditLogs.spec.ts && pnpm --dir apps/web run lint`

Expected: PASS with no lint errors.

- [ ] **Step 5: Commit the visual and accessibility pass**

```bash
git add apps/web/src/modules/system/views/AuditLogs.vue apps/web/src/modules/system/__tests__/AuditLogs.spec.ts
git commit -m "polish(web): refine audit logs responsive states"
```

---

### Task 5: Run the full verification suite

**Files:**
- No planned source changes; only fix issues discovered in the preceding tasks.

- [ ] **Step 1: Run focused system-module tests**

Run: `pnpm --dir apps/web exec vitest run src/modules/system/__tests__`

Expected: PASS for display helpers, API path contract, and page behavior.

- [ ] **Step 2: Run all web tests**

Run: `pnpm --dir apps/web run test:run`

Expected: PASS. If unrelated existing failures occur, record their exact test names and output rather than changing unrelated modules.

- [ ] **Step 3: Run type checking and production build**

Run: `pnpm --dir apps/web run check-types && pnpm --dir apps/web run build`

Expected: both commands exit 0; Vite emits the production bundle.

- [ ] **Step 4: Inspect the final diff**

Run: `git diff main --stat && git status --short`

Expected: only audit-log UI files, its tests, and the design/plan documents are changed; no generated build artifacts or unrelated formatting changes appear.

- [ ] **Step 5: Commit any verification-only fixes**

```bash
git add apps/web/src/modules/system docs/superpowers/specs/2026-08-24-audit-logs-ui-design.md docs/superpowers/plans/2026-08-24-audit-logs-ui.md
git commit -m "test(web): verify audit logs page"
```
