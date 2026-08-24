# Audit Logs 前端页面设计

## 目标

为 NexusAI Platform 提供可扫描、可筛选、可追溯的审计日志页面。页面服务于管理员和运营人员，核心任务是按操作者、动作、实体、知识库和时间范围定位一条操作记录，并查看其完整上下文。

本次范围仅包含 `apps/web` 前端页面、审计日志 API 适配、类型/composable 和前端测试；不新增后端统计接口、不改变审计日志写入逻辑。

## 现状与约束

- 前端入口为 `apps/web/src/modules/system/views/AuditLogs.vue`，当前仅展示最小表格。
- 路由已存在：`/audit-logs`。
- 后端契约规划为 `GET /audit-logs`，支持 `user/action/entityType/kbId/时间范围` 筛选和分页。
- HTTP 客户端已配置 `/api/v1` 全局前缀，因此审计 API 使用相对路径 `/audit-logs`，避免重复前缀。
- 数据字段来自 `AuditLog`：`id`、`userId`、`action`、`entityType`、`entityId`、`kbId`、`details`、`ipAddress`、`createdAt`，用户和知识库显示名允许由后端展开返回，前端保留字段缺省兼容。
- 页面延续现有 Vue 3、TypeScript、TanStack Query、Element Plus、Tailwind 和三套主题变量。

## 视觉方向

页面定位为“治理控制台”，使用现有网格背景、主题色和 Bricolage Grotesque 标题字体。主体保持高密度、克制的后台信息布局：

- 页面头部：Lock 图标标记、标题“审计日志”、简短说明、刷新按钮。
- 摘要区：记录总量、当前筛选结果、最近活动时间三个轻量指标，不引入未经后端聚合支持的趋势图。
- 筛选区：关键词、动作、实体类型、知识库、日期范围，以及重置筛选操作。
- 主表格：时间、操作者、操作、目标、知识库、来源 IP、操作列；时间列使用细竖线和节点形成“事件轨道”视觉记忆点，表达事件连续性。
- 详情抽屉：点击“查看详情”打开右侧抽屉，展示动作、操作者、目标、知识库、时间、IP、实体 ID 和格式化 JSON 详情。
- 状态：加载骨架、无筛选结果、无日志、请求失败均提供明确反馈；移动端将表格切换为事件列表，避免字段被压缩。

## 组件与边界

### `AuditLogs.vue`

负责页面状态和组合：

- `filters` 保存 keyword、user、action、entityType、kbId、dateRange。
- `page` 和 `pageSize` 管理分页。
- 由 computed 生成 `AuditLogListParams`，空值不发送。
- 通过 `useAuditLogs` 获取数据，watch 筛选条件时回到第一页。
- 管理详情抽屉和选中日志。
- 只负责展示和交互，不在视图内拼装 HTTP 请求。

### `audit-logs.api.ts`

提供 `list(params)`，调用 `http.get('/audit-logs', { params })`。对外暴露类型化的列表响应。

### `useAuditLogs.ts`

使用 TanStack Query：

- query key 包含规范化后的参数。
- 筛选或分页变化时自动刷新。
- 保留上一页数据作为 placeholder，避免分页切换时页面闪烁。
- 不启用高频轮询；审计记录是追加型数据，用户可通过刷新按钮主动更新。

### `audit-log.ts`

定义：

- `AuditLog` 记录实体。
- `AuditLogListParams` 查询参数。
- `AuditLogListResponse` 分页响应。
- `AuditAction`、动作显示映射和实体类型显示映射。

响应适配支持后端的分页对象，同时兼容开发阶段可能返回的数组：数组会转换成当前页列表，总数使用数组长度。

## 交互与数据流

```text
用户修改筛选 / 分页
        ↓
AuditLogs.vue computed params
        ↓
useAuditLogs(params)
        ↓
auditLogsApi.list(params)
        ↓
GET /api/v1/audit-logs（由 client 全局前缀生成）
        ↓
表格与摘要更新
        ↓
点击行 / 查看详情 → 详情抽屉
```

### 筛选行为

- 关键词用于操作者、目标 ID、目标名称和 IP 的后端搜索参数；具体字段由后端解释。
- 动作、实体类型、知识库使用下拉选项。
- 日期范围转换为 `startDate` / `endDate`，日期按当天起止发送，避免时区导致边界遗漏。
- 任一筛选条件变化时页码回到 1。
- “重置筛选”清空所有条件并回到第一页。

### 详情行为

- 抽屉宽度为 `min(560px, 92vw)`。
- JSON 详情使用 `JSON.stringify(details, null, 2)`，无法序列化时显示原始文本或 `--`。
- 长 ID 和 JSON 内容允许换行，支持复制实体 ID / 日志 ID；复制成功和失败均有提示。
- 抽屉关闭不影响查询结果。

## 错误与空状态

- 初次加载显示骨架，不显示空表闪烁。
- 查询失败显示 Element Plus 错误提示，并保留上一份数据（若存在）；页面提供刷新按钮重试。
- 有筛选但无结果：显示“没有匹配的审计记录”和“清空筛选”。
- 无筛选且无数据：显示“暂无审计记录”，说明审计事件会在关键操作发生后出现。
- 后端字段缺失时使用 `--`，不能因单行字段异常导致整个页面渲染失败。

## 响应式与可访问性

- 桌面端使用表格，目标列和详情操作固定最小宽度。
- 小于 900px 时筛选控件换行；小于 640px 时将记录用事件卡片展示。
- 所有图标按钮提供 `aria-label` 或 tooltip；详情抽屉、复制按钮可键盘操作。
- 使用现有 `prefers-reduced-motion` 规则，事件轨道和入场动画不影响减少动效用户。
- 颜色只用于动作语义和状态强调，文本仍保留明确标签，满足色觉差异下的可读性。

## 测试范围

- API 使用相对路径 `/audit-logs`，不产生 `/api/v1/api/v1` 双前缀。
- 查询参数正确转换，空值被省略，日期范围转换正确。
- 分页响应和数组响应均能规范化。
- 动作、实体类型和详情格式化函数覆盖未知值和空值。
- 页面筛选重置、分页、空状态和详情抽屉至少有组件级测试；测试遵循现有 Vitest + Vue Test Utils 模式。

## 验收标准

1. 访问 `/audit-logs` 可看到符合当前主题的审计日志治理页面。
2. 可按关键词、动作、实体类型、知识库和日期范围筛选，并正确分页。
3. 页面请求使用单一 `/api/v1` 前缀，后端返回分页对象时不再依赖 `unknown[]`。
4. 可打开任意日志详情，查看完整上下文和 JSON 详情，并复制 ID。
5. 加载、失败、空结果和移动端布局均有可用表现。
6. Web 类型检查、相关 Vitest 测试和生产构建通过。
