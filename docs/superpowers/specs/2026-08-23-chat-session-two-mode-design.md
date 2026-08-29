# ChatSession 两模式创建 + resolveTarget 自包含 设计

日期：2026-08-23

## 背景与问题

`CreateSessionDto.aiApplicationId` 是可选的（手动选择 KB/Workflow 场景不传），但 `ChatService.resolveTarget` 目前要求会话必须绑定 AI 应用，否则直接抛 `'会话未绑定 AI 应用'`：

```ts
if (!session.aiApplicationId) throw new BadRequestException('会话未绑定 AI 应用');
const app = await this.prisma.aiApplication.findUnique({...});
if (!app) throw new BadRequestException('AI 应用不存在');
const kbId = session.kbId ?? app.knowledgeBaseId;
const model = await this.modelCaller.resolveChatModel(app.modelId);
```

问题：
1. 无 `aiApplicationId` 的会话无法对话。
2. 会话本身不携带 `modelId`，模型只能从 AI 应用解析。
3. 前端 `CreateSessionDialog` 自定义模式缺少模型/工具选择，无法表达完整的手动绑定。

## 目标

- 创建会话支持两种模式：**快捷模式**（选 AI 应用，后端把应用的绑定快照到会话）与**自定义模式**（手动选 kb / workflow / model / prompt / tools）。
- 会话**自包含**：`ChatSession` 自身携带 `kbId / workflowId / modelId / promptTemplateId`（+ tools 关联），`resolveTarget` 只依赖会话字段即可对话。
- `aiApplicationId` 完全可选；保留旧会话（仅有 `aiApplicationId`、缺 `modelId`）的 AI 应用回退解析。

## 设计决策

| 决策点 | 结论 |
| --- | --- |
| 会话 tools 存储 | 新增 `ChatSessionTool` 关联表（仿 `AiApplicationTool`，N:M，有 FK 约束） |
| 快捷模式语义 | 创建时**快照** app 的绑定到会话（session 自包含），`aiApplicationId` 仅记录来源 |
| resolveTarget 兼容 | 会话字段优先；会话缺 `modelId`/`kbId` 且带 `aiApplicationId` 时才查 app 回退 |
| 工具消费 | 本轮只持久化，`streamMessage` 管线暂不消费（尚无 tool-calling） |

## Schema 变更（prisma/schema.prisma）

`ChatSession` 增加：

```prisma
modelId String? @map("model_id") @db.Uuid
model   Model?  @relation(fields: [modelId], references: [id], onDelete: SetNull)
```

新增关联表：

```prisma
model ChatSessionTool {
  id        String   @id @default(uuid()) @db.Uuid
  sessionId String   @map("session_id") @db.Uuid
  toolId    String   @map("tool_id") @db.Uuid
  createdAt DateTime @default(now()) @map("created_at") @db.Timestamptz()

  session ChatSession @relation(fields: [sessionId], references: [id], onDelete: Cascade)
  tool    Tool        @relation(fields: [toolId], references: [id], onDelete: Cascade)

  @@unique([sessionId, toolId])
  @@index([sessionId])
  @@map("chat_session_tools")
}
```

`Tool` 增加反向 relation：`sessions ChatSessionTool[]`。

迁移：`prisma migrate dev --name chat_session_model_and_tools` + `prisma generate`。

## 后端

### CreateSessionDto（create-session.dto.ts）

增加：

```ts
@IsString() @IsOptional() modelId?: string;
@IsArray() @IsOptional() @IsString({ each: true }) toolIds?: string[];
```

`aiApplicationId` 保持可选。

### SessionService.create

- **快捷模式**（`dto.aiApplicationId` 存在）：
  1. `aiApplication.findUnique`（select `knowledgeBaseId/workflowId/modelId/promptTemplateId`，include `tools: { select: { toolId } }`）；查不到抛 `NotFoundException('AI 应用不存在')`。
  2. 快照写入 `chatSession.create`：`kbId/knowledgeBaseId`、`workflowId`、`modelId`、`promptTemplateId`、`aiApplicationId`（来源）。
  3. `workflowType`：以后端为准，从 app 的 workflow 解析 type，失败回退 `DEFAULT_WORKFLOW_TYPE`（前端传的值会被覆盖）。
  4. `chatSessionTool.createMany` 写入 app 的 toolIds。
- **自定义模式**（无 `aiApplicationId`）：沿用现有逻辑（workflow 解析 type），额外写入 `modelId`，`toolIds` 同样 `createMany` 到 `ChatSessionTool`。

### ChatService.resolveTarget

```
select session: { id, kbId, modelId, promptTemplateId, aiApplicationId }
if (!session) throw '会话不存在'
// 旧会话兼容：仅当会话缺 modelId 或 kbId 且带 aiApplicationId 时才查 app
if ((!session.modelId || !session.kbId) && session.aiApplicationId) → app = aiApplication.findUnique
   if (!app) throw 'AI 应用不存在'
modelId      = session.modelId ?? app?.modelId        // 都没有 → '会话未配置模型'
kbId         = session.kbId   ?? app?.knowledgeBaseId  // 都没有 → '会话未配置知识库'
systemPrompt = resolveSystemPrompt(session.promptTemplateId ?? app?.promptTemplateId)
return { kbId, model, systemPrompt }
```

移除 `'会话未绑定 AI 应用'` 硬性报错。

## 前端

### CreateSessionDialog.vue

- 顶部 `el-radio-group` 切换「快捷模式 / 自定义模式」。
- **快捷模式**：仅显示 AI 应用下拉；payload `{ title, aiApplicationId, workflowType: DEFAULT }`（快照由后端完成）。
- **自定义模式**：KB、提示词、工作流、模型（`useModels`，`displayName`）、工具（`useTools`，`el-select multiple`）下拉；payload 显式携带 `modelId`、`toolIds`。
- 选中 app 后禁用并清空自定义项（沿用现有 `appBound` 思路）。
- 模式切换时重置对应字段。

### 类型与 API

- `CreateSessionPayload` 增加 `modelId?: string`、`toolIds?: string[]`。
- `ChatSession` 类型增加 `modelId?: string`。

## 测试

- `chat.service.spec.ts`：
  - 现有用例（session 带 `aiApplicationId`、无 `modelId` → app 回退）保持绿。
  - 新增：会话自带 `modelId`、无 `aiApplicationId` → 直接走 session 字段、`aiApplication.findUnique` 不被调用。
  - 新增：两者皆无 → 抛 `'会话未配置模型'`。
- `session.service.spec.ts`（如存在）：补快捷模式快照 + `chatSessionTool.createMany` 断言。

## 范围外（Out of scope）

- tool-calling：`streamMessage` 管线暂不消费会话绑定的 tools，仅持久化。
- KB 权限校验（`kb_permissions`）不在本轮。
- AI 应用模块本身的 CRUD（后端 create/update 目前是 stub）不在本轮。
