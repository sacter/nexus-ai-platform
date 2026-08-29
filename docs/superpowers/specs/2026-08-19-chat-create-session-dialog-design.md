# 新建会话配置弹窗 + `@nexus/config` 公共包 — 设计文档

日期：2026-08-19
状态：已确认（A/A/A 方案 + packages/config 合并方案）

## 背景与目标

当前 chat 模块新建会话是**懒创建**：`/chat/new` 路由下首条消息发送时才无参调用 `POST /chat/sessions`，会话的 `kbId / promptTemplateId / aiApplicationId / workflowId / workflowType / title` 全部没有入口填写。

本次目标：

1. 新建会话时弹出 ElDialog 收集完整会话配置，**创建成功后再跳转** `/chat/:id`
2. 把 `workflow_type` 枚举（`'rag' | 'reflection' | 'rewoo' | 'multi_agent'`，见 DATABASE.md `workflow_type_enum`）提取到公共包，前后端及后期 Workflow 模块共用单一来源
3. 借机把 `packages/config` 空目录建成统一的 `@nexus/config` 共享配置包，并迁移现有 `@nexus/model-config`，避免 packages/ 下包数量膨胀

### 已确认的关键决策

| 决策点 | 结论 |
|---|---|
| 弹窗触发/提交时机 | 统一弹窗：点「新会话」/建议卡片 → 弹窗 → 提交即创建 → 跳转 `/chat/:id`。废弃 `/chat/new` 懒创建 |
| 必填字段 | 仅 `title` 必填，其余选填 |
| 后端范围 | **只做前端**；`POST /chat/sessions` 端点由用户自行实现（注意 DTO 缺 `aiApplicationId`） |
| `workflowType` 来源 | 弹窗不提供选择器；选了 Workflow 就带该 workflow 的 `type`，未选 → `'rag'` |
| enum 落点 | `packages/config`（`@nexus/config`），一个 config 一个 ts 文件 |
| 弹窗挂载点 | `ChatSessionList` 内部（它被两个视图复用，单点生效） |
| AI 应用 vs 手动选择 | **互斥**：选了 AI 应用则 KB/提示词/工作流三项禁用并清空（AI App = KB + Workflow + Model + Prompt + Tools 的资源绑定，见 DATABASE.md 4.8 注释） |

### 建议卡片与 DEFAULT_SUGGESTIONS 的关系（调查结论）

`DEFAULT_SUGGESTIONS`（`components/suggestions.ts`）只是空状态的消息引导卡片，与会话配置正交，**不需要绑定**。本次顺带修复一个现存问题：`ChatList` 中点击建议卡片会丢弃 `text`（`onSuggest` 直接跳路由）。卡片自定义（按 KB/提示词模板生成建议）为后续增强，不在本次范围。

## 1. 公共包 `@nexus/config`（复用 `packages/config`，迁移 model-config）

结构/构建方式完全仿照 `@nexus/model-config`（纯 TS、tsc → dist、零运行时依赖）：

```
packages/config/
  package.json        # name: @nexus/config，main/types → dist，tsc 构建
  tsconfig.json       # 与 model-config 相同
  src/
    index.ts           # export * from './model-config.js'; export * from './workflow-config.js'
    model-config.ts    # 自 packages/model-config/src/index.ts 原样迁入（内容不变）
    workflow-config.ts # 新增，内容如下
```

```ts
// workflow-config.ts
export const WORKFLOW_TYPES = ['rag', 'reflection', 'rewoo', 'multi_agent'] as const
export type WorkflowType = (typeof WORKFLOW_TYPES)[number]
export const DEFAULT_WORKFLOW_TYPE: WorkflowType = 'rag'
export const WORKFLOW_TYPE_LABELS: Record<WorkflowType, string> = {
  rag: 'RAG 问答',
  reflection: 'Reflection',
  rewoo: 'ReWOO',
  multi_agent: '多智能体',
}
```

两侧导出无重名（`PROVIDERS`/`MODEL_CONFIG_*` vs `WORKFLOW_*`），`index.ts` 用 `export *` 合并。`WORKFLOW_TYPE_LABELS` 供会话列表 el-tag 与后期 Workflow 模块展示用。

**现有 `@nexus/model-config` 消费方迁移**（import 改为 `@nexus/config`，纯路径替换、无逻辑改动）：

| 位置 | 改动 |
|---|---|
| `apps/web/src/modules/api-keys/types/api-key.ts` | import 路径替换 |
| `apps/web/src/modules/models/types/model.ts` | import 路径替换 |
| `apps/web/src/modules/models/components/ModelForm.vue` | import 路径替换 |
| `apps/web/vite.config.ts` | alias `'@nexus/model-config'` → `'@nexus/config'` 指向 `packages/config/src/index.ts`（沿用既有模式：**web 别名消费 TS 源，api 消费 dist**——规避 Rollup 对 CJS dist 命名导出的检测问题） |
| `apps/web/package.json` | 依赖 `@nexus/model-config` → `@nexus/config` |
| `apps/api/src/modules/model/model.service.ts` | import 路径替换 |
| `apps/api/package.json` | 依赖 `@nexus/model-config` → `@nexus/config` |
| `packages/model-config/` | **删除** |

worker 当前未消费 `@nexus/model-config`，本次不改；后续按需加 `@nexus/config` 依赖即可。

> 注意：monorepo 中 `@nexus/*` 包通过 dist 构建产物消费（Node 24 下 src TS 无法在 api dev 解析），`@nexus/config` 需先 build，api/worker 的 dev 依赖 `^build`。

## 2. 新组件 `CreateSessionDialog.vue`

位置 `apps/web/src/modules/chat/components/CreateSessionDialog.vue`，ElDialog + ElForm。

| 字段 | 控件 | 规则 |
|---|---|---|
| 标题 `title` | ElInput | 必填，≤512 |
| AI 应用 `aiApplicationId` | ElSelect（clearable / filterable） | 选中后**禁用并清空**下面三项 |
| 知识库 `kbId` | ElSelect（clearable / filterable） | 互斥受控 |
| 提示词 `promptTemplateId` | ElSelect（clearable / filterable） | 互斥受控 |
| 工作流 `workflowId` | ElSelect（选项显示 name + type tag） | 互斥受控 |

- 组件 API：`defineExpose({ open(prefill?: { title?: string }) })`；emit `created(session)`
- 选项数据：复用现有 composable——`useKnowledgeBases()`（knowledge）、`useAiApplications()`（ai-application）、`useWorkflows()`（workflow）；prompt 侧目前只有裸 `promptsApi.list()`，按 knowledge/ai-application/workflow 的惯例在 prompt 模块新增 `modules/prompt/composables/usePrompts.ts`（`usePromptTemplates()` query）。四个 query 的 `enabled` 跟随弹窗可见性，未打开不请求
- workflow 选项的后端返回结构未定，组件内定义最小结构收窄：`{ id: string; name: string; type: WorkflowType }`
- 互斥逻辑：`watch(aiApplicationId)`，有值则清空 `kbId / promptTemplateId / workflowId` 并 disable 三控件；清空 AI 应用则恢复

**提交 payload**（`chat.api.ts` 中导出）：

```ts
export interface CreateSessionPayload {
  title: string
  kbId?: string
  promptTemplateId?: string
  aiApplicationId?: string
  workflowId?: string
  workflowType: WorkflowType   // 选中 workflow 的 type；未选 → DEFAULT_WORKFLOW_TYPE
}
```

`chatApi.createSession` 签名改为 `(data: CreateSessionPayload): Promise<ChatSession>`。

## 3. 数据流 / 集成

- **挂载点**：`ChatSessionList` 内部持有 dialog ref 与 `openDialog()`，经 `defineExpose` 暴露给父视图；「新会话」按钮改为调 `openDialog()`
- **ChatList**：
  - `onNew` → `sessionListRef.openDialog()`
  - 建议卡片点击 → `openDialog({ title: 卡片标题 })`
  - `ChatEmptyState` 的 `suggest` 事件改传整个 `ChatSuggestion` 对象：ChatList 取 `.title` 预填，ChatSession 仍取 `.text` 发送（修复 text 被丢弃的问题）
- **ChatSession**：建议卡片维持现状直接 `send(text)`（统一弹窗后会话必然已创建）；「新会话」按钮同样走 `openDialog()`
- **创建成功**：dialog emit `created` → 父级 `router.push('/chat/' + session.id)` + `invalidateQueries(['chat-sessions'])` 刷新侧栏
- **移除 `/chat/new` 懒创建路径**：
  - `router/index.ts`：`/chat/new` → `redirect: '/chat'`
  - `useChat.send()`：删除 `sid === 'new'` 的 `pendingCreate` 创建分支
  - `MessagePhase` 移除 `'pendingCreate'`：涉及 `types/chat.ts`（union）、`useChat.ts:64`（isStreaming 判断）、`ChatStreamStatus.vue:11,14`（文案与可见性数组）
  - `ChatSession.vue` 的 `headerTitle` 中 `'new'` 分支、`useChatMessages` 的 `!== 'new'` enabled 判断一并清理

## 4. 错误处理

- 任一选项源加载失败：对应 ElSelect 下方显示错误提示 + 重试，**不阻塞**仅标题创建
- 提交失败：`ElMessage.error('创建会话失败')`，弹窗保持打开、按钮 loading 复位、表单内容保留
- `title` 校验走 ElForm rules（required + max 512）

## 5. 测试

- 新增 `CreateSessionDialog.spec.ts`：
  - 仅标题提交 → payload 为 `{ title, workflowType: 'rag' }`
  - 选 workflow → payload 带 `workflowId` + 该 workflow 的 `type`
  - 选 AI 应用 → 三控件禁用且值被清空，payload 只带 `aiApplicationId`（+ `workflowType: 'rag'`）
  - title 为空 → 校验错误、不提交
  - `open({ title })` → 表单预填
- `ChatEmptyState.spec.ts`：适配 `suggest` 事件改传对象
- `useChatStream` 相关用例：删除/调整 `pendingCreate` 与新会话懒创建分支的用例
- model-config 迁移：回归验证 models / api-keys 模块现有测试与构建通过

## 6. 后端侧提醒（不在本次范围）

- `POST /chat/sessions` 端点、`SessionService.create` 由用户自行实现
- `CreateSessionDto` 需补 `aiApplicationId?: string`（Prisma schema 已有该列）
- DTO 可用 `@nexus/config` 的 `WORKFLOW_TYPES` 配 `@IsIn(WORKFLOW_TYPES)` 校验 `workflowType`
- `userId` 来源（鉴权/临时 mock）由用户决定
