# Workflows 前端页面设计与开发（仅前端）

日期：2026-08-28
来源：`ARCHITECTURE.md`、`DATABASE.md`、`prisma/schema.prisma`、`docs/superpowers/plans/2026-08-16-later-development-execution-plan.md` P4
角色：仅前端开发（后端 API 由项目主自行实现）

## 1. 范围与目标

按 P4（Workflow 执行引擎）落地 Workflows 前端运行时 UI。本次交付：

- Workflow 列表页（搜索 + 类型筛选 + 卡片网格）
- Workflow 创建页（基本信息 + 顶层 config JSON + 节点列表 + 边列表）
- Workflow 编辑页（同表单，回填）
- Workflow 详情页（页头操作 + 流程图预览 + 顶层配置 + 执行历史列表）
- 单次执行详情页（输入 / 输出 / 错误 / 节点步骤时间线 + RUNNING 轮询）

显式不做：

- 拖拽式 Designer（属 V3，由 `apps/web/src/modules/workflow/views/WorkflowDesigner.vue` 承接；
  本次保留既有的空白画布壳，供 V3 改写）
- ReWOO / Multi-Agent 策略节点编辑（P4 仅打桩，推荐 UI 不暴露特殊字段）
- 后端 API 实现

## 2. 后端契约（前端依赖，列出供后端实现）

按 `ARCHITECTURE.md` §「后端 API 路由」 + `P4 Task 4.1/4.2`：

```
GET    /api/v1/workflows                                  # 列表
POST   /api/v1/workflows                                  # 创建（body 含 nodes[]/edges[]）
GET    /api/v1/workflows/:id                              # 详情（含 nodes/edges 图结构）
PATCH  /api/v1/workflows/:id                              # 更新（同时覆盖 nodes/edges，事务）
DELETE /api/v1/workflows/:id                              # 删除
POST   /api/v1/workflows/:id/run                          # 手动执行（同步返回 execution），body { input? }
GET    /api/v1/workflows/:id/executions                   # 执行历史
GET    /api/v1/workflows/:id/executions/:execId           # 单次执行详情（含 node_steps）
```

DTO 关键字段（嵌套 nodes/edges）：

- `nodes[]`: `{ clientId, type, label, description?, positionX, positionY, config }`
  - `clientId`：前端在提交时生成的客户端本地 id，后端落库时替换为 uuid；边通过 clientId 引用节点
- `edges[]`: `{ sourceClientId, targetClientId, sourceHandle?, targetHandle?, label?, condition? }`

`WorkflowExecution.node_steps[]` 在策略 run 过程逐步追加（参考 `DATABASE.md` §4.17），其中
Human-in-the-loop 语义保留为 `PAUSED` / `WAITING` 状态（本阶段 UI 仅展示，不提供 resume 按钮）。

## 3. 数据模型对齐（prisma/schema.prisma）

| Prisma Model          | 用途                                              | 前端类型           |
| --------------------- | ------------------------------------------------- | ------------------ |
| `Workflow`            | 主表（id/name/type/description/version/config/isActive） | `Workflow`         |
| `WorkflowNode`        | 图节点（含 position_x/y 供 V3 Designer）          | `WorkflowNode`     |
| `WorkflowEdge`        | 图边（source/target handle + label + condition）  | `WorkflowEdge`     |
| `WorkflowExecution`   | 单次执行（nodeSteps JSONB）                       | `WorkflowExecution` |

枚举：

- `ExecutionStatus`: RUNNING / COMPLETED / FAILED / CANCELLED / PAUSED / WAITING
- `WorkflowNodeType`: start / end / retriever / llm / tool / condition / reflection / planner / solver / aggregator / code
- `WorkflowType`（`@nexus/config`）：rag / reflection / rewoo / multi_agent

## 4. 前端架构

### 4.1 目录结构（与 `AppList/AppDetail/AppForm` 同风格）

```
apps/web/src/modules/workflow/
├── api/
│   └── workflow.api.ts          # REST 客户端（list/get/create/update/delete/run/listExecutions/getExecution）
├── composables/
│   └── useWorkflow.ts           # TanStack Query 封装（list/detail/create/update/delete/run/executions）
├── types/
│   └── workflow.ts              # 类型 + 常量（WORKFLOW_TYPES、NODE 类型、状态、ICON/COLOR META）
├── utils/
│   └── workflow-payload.ts      # 表单状态 <-> 提交 payload（clientId 生成、JSON parse、自环防御）
├── components/
│   ├── WorkflowCard.vue         # 列表卡片
│   ├── WorkflowGraphPreview.vue # 只读 Vue Flow 流程图预览（替代 V3 拖拽编辑）
│   └── ExecutionList.vue        # 执行历史表格（时间/状态/耗时/输入摘要/步骤数/详情）
└── views/
    ├── WorkflowList.vue         # 列表页（搜索 + 类型筛选）
    ├── WorkflowForm.vue         # 创建/编辑（共用）
    ├── WorkflowDetail.vue       # 详情页（图预览 + 配置 JSON + 执行历史）
    ├── ExecutionDetail.vue      # 执行详情（含轮询 RUNNING / WAITING）
    └── WorkflowDesigner.vue     # V3 占位（保留既有）
```

### 4.2 路由（`apps/web/src/router/index.ts`）

```
/workflows                                  → WorkflowList.vue
/workflows/new                              → WorkflowForm.vue       (create)
/workflows/:id                              → WorkflowDetail.vue
/workflows/:id/edit                         → WorkflowForm.vue       (edit)
/workflows/:id/executions/:execId           → ExecutionDetail.vue
/workflows/designer                         → WorkflowDesigner.vue   (V3 预留)
```

### 4.3 关键设计决策

| 决策点                     | 选择                                                                                | 原因                                                                       |
| -------------------------- | ----------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| 编辑模式                   | 「基本信息 + JSON 顶层 config + 节点表 + 边表」表单                                  | V3 才上拖拽 Designer；P4 任务清单明确「先做列表+基本信息」                 |
| 图预览                     | 复用 `@vue-flow/core` 只读渲染（不可拖/不可连）                                     | 不在 V2 侵入式设计器，但可视化反馈对 DAG 必要                              |
| node_steps 时间线          | 步骤 label + 状态 tag + input/output JSON pre + 错误 alert                          | 对齐 DATABASE.md node_steps 字段 + P4「看到节点步骤与耗时」验收              |
| 运行中轮询                 | ExecutionDetail 内 2s 轮询（status ∈ {RUNNING, WAITING}）                           | 后端可能同步或非流式；不动 SSE 已足够（P4 SSE 未明确）                     |
| 顶层 config vs 节点 config | 顶层 textarea JSON；每个节点独立 JSON textarea                                      | 与 schema.config/config 完全映射，无字段提升                               |
| Run 入口                   | 列表卡片 ⚡ + 详情页主按钮 + 详情执行历史「再跑一次」                                | ARCHITECTURE 页面 9 描述                                                   |
| 类型元信息                 | `WORKFLOW_TYPE_META[type] = { icon(emoji), color, hint }`                          | 与 AppCard 图标字风格保持一致                                              |
| clientId 协议              | 节点在 payload 中带临时 `clientId`；edges 通过 clientId 引用；编辑时复用真实 uuid   | P4 契约「嵌套 nodes[]/edges[] 事务写入」；便于前端在边表中引用未保存节点    |
| 自环防御                   | `buildWorkflowPayload` 拒绝 sourceClientId === targetClientId                        | 数据库唯一约束不允许，提前失败优化 UX                                       |

### 4.4 状态管理

- TanStack Query：`['workflows']`、`['workflows', id]`、`['workflows', id, 'executions']`、`['workflows', id, 'executions', execId]`
- 失效策略：create/update/delete → 失效 `['workflows']`；run → 失效 `['workflows', id, 'executions']`
- 表单状态：模块本地 reactive + watch（参考 `AppForm` 模式）

## 5. 已知遗留 / follow-up

1. **`/workflows/designer` 静态路由**：仍指向 V2 空白画布，未接拖拽逻辑；V3 需要提供节点库 + save 联动。
2. **节点 `position-x/y` 策略**：表单模式下按 (i%4*220, ⌊i/4⌋*140) 自动生成；V3 Designer 落地时改为画布坐标持久化。
3. **执行 `PAUSED` / `WAITING` 的暂停/恢复按钮**：等后端实现 `POST /executions/:execId/resume`（P4 仅描述），前端再加操作列。
4. **Workflow 列表的执行历史预览**：列表卡片暂无 mini 统计（待 P4 后端 list 接口附加 `lastExecutionStatus`/`lastExecutionAt`）。
5. **执行 SSE 流式**：暂用轮询（2s），后端实现可平滑切换（保留 refetch 钩子位）。
6. **依赖跨模块的 P5 接线**：`AppForm.vue` 中「选择工作流」下拉引用 `useWorkflows`，依赖新 list 接口可用。

## 6. 验收对照（P4 验收 → UI 路径）

| 验收                                     | 路径                                                                                         |
| ---------------------------------------- | -------------------------------------------------------------------------------------------- |
| 可创建带 rag 策略的 workflow             | `/workflows/new` → 表单「策略类型=rag」→ 提交 → 详情 `nodes/edges` 含 retriever/llm/judge |
| 可 run 并看到节点步骤与耗时              | 详情页「立即运行」→ 跳 ExecutionDetail → 节点步骤时间线（每步耗时 ms/s）                   |
| Reflection 策略可跑通生成→自查           | type=reflection 工作流，执行详情可见 reflection 节点步骤循环                                  |

## 7. 文件清单（创建/修改）

| 操作 | 文件                                                                                                |
| ---- | --------------------------------------------------------------------------------------------------- |
| 新建 | `apps/web/src/modules/workflow/types/workflow.ts`（重写）                                          |
| 新建 | `apps/web/src/modules/workflow/utils/workflow-payload.ts`                                          |
| 新建 | `apps/web/src/modules/workflow/components/WorkflowGraphPreview.vue`                               |
| 修改 | `apps/web/src/modules/workflow/api/workflow.api.ts`                                                 |
| 修改 | `apps/web/src/modules/workflow/composables/useWorkflow.ts`                                          |
| 修改 | `apps/web/src/modules/workflow/components/WorkflowCard.vue`                                        |
| 修改 | `apps/web/src/modules/workflow/components/ExecutionList.vue`                                       |
| 修改 | `apps/web/src/modules/workflow/views/WorkflowList.vue`                                              |
| 修改 | `apps/web/src/modules/workflow/views/WorkflowDetail.vue`                                            |
| 新建 | `apps/web/src/modules/workflow/views/WorkflowForm.vue`                                            |
| 新建 | `apps/web/src/modules/workflow/views/ExecutionDetail.vue`                                          |
| 修改 | `apps/web/src/router/index.ts`（追加 4 条路由）                                                     |

## 8. 回归风险

- `useWorkflows()` 的返回类型从 `unknown[]` 升级为 `Workflow[]`，`AppForm.vue` 现有的 `(workflows.value ?? []) as unknown as WorkflowOption[]` 不再需要 unknown cast，但不影响现有行为（编译期仍兼容）。
- 路由新增 `workflows/new`、`workflows/:id/edit`，与既有 `AppForm` 路由的 `/ai-applications/new` 静态叠在动态前的模式一致，无冲突。
- 类型 `ExecutionStatus` 与后端 `ExecutionStatus` Prisma enum 对齐（`RUNNING`/`COMPLETED`/`FAILED`/`CANCELLED`/`PAUSED`/`WAITING`）。
