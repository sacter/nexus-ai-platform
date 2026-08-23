# ChatSession 两模式创建 + resolveTarget 自包含 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 创建会话支持「快捷模式（AI 应用快照）/ 自定义模式（手动选 kb/model/prompt/workflow/tools）」；`ChatSession` 携带 `modelId` 与工具关联，`resolveTarget` 依赖会话自身字段即可对话，AI 应用仅作为旧会话回退来源。

**Architecture:** 后端把 AI 应用的绑定（kb/workflow/model/prompt/tools）在 `POST /chat/sessions` 创建时**快照**到 `chat_session`（新增 `model_id` 列）与新增的 `chat_session_tools` 关联表，使会话自包含；`ChatService.resolveTarget` 改为「session 字段优先，缺 `modelId`/`kbId` 且带 `aiApplicationId` 时才回退查 AI 应用」。前端 `CreateSessionDialog` 拆成两个互斥模式，各自渲染对应选择器并组装 payload。

**Tech Stack:** NestJS + Prisma（Postgres）、Element Plus + Vue 3 + @tanstack/vue-query + Vitest、Jest（api）。

---

## File Structure

**Backend（apps/api）：**
- `prisma/schema.prisma` — `ChatSession` 加 `modelId` + `chatSessions`/`sessions` 反向 relation + 新 `ChatSessionTool` 模型。
- `apps/api/src/modules/chat/dto/create-session.dto.ts` — 加 `modelId?`、`toolIds?: string[]`。
- `apps/api/src/modules/chat/session.service.ts` — 快捷快照 + 自定义 toolIds 写入。
- `apps/api/src/modules/chat/session.service.spec.ts` — **新建**，覆盖两种模式的 create 逻辑。
- `apps/api/src/modules/chat/chat.service.ts` — `resolveTarget` 自包含 + 旧会话回退。
- `apps/api/src/modules/chat/chat.service.spec.ts` — 新增无 app 自包含 / 缺模型报错用例。

**Frontend（apps/web）：**
- `src/modules/models/composables/useModels.ts` — 加可选 `enabled` 参数（对齐 useKnowledgeBases 门控模式）。
- `src/modules/tools/composables/useTools.ts` — 同上。
- `src/modules/chat/types/chat.ts` — `ChatSession` 加 `modelId?`。
- `src/modules/chat/api/chat.api.ts` — `CreateSessionPayload` 加 `modelId?`、`toolIds?: string[]`。
- `src/modules/chat/components/CreateSessionDialog.vue` — 两模式重写。
- `src/modules/chat/__tests__/CreateSessionDialog.spec.ts` — 两模式测试重写。

**Docs：**
- `DATABASE.md` — chat_sessions 增 `model_id` 列说明、新增 `chat_session_tools` 表。

---

### Task 0: 建功能分支

- [ ] **Step 1: 切新分支**

```bash
cd /Users/aibee/Documents/code/demo/agent/nexus-ai-platform
git checkout -b feat/chat-session-two-mode
```

- [ ] **Step 2: 确认在分支上**

Run: `git branch --show-current`
Expected: `feat/chat-session-two-mode`

---

### Task 1: Prisma schema —— ChatSession.modelId + ChatSessionTool

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: 改 schema —— ChatSession 加 modelId 与 relations**

在 `model ChatSession` 的 `promptTemplateId` 行后加字段：

```prisma
  modelId           String?  @map("model_id") @db.Uuid                          // ★ V3: 会话自带模型（自包含）
```

在 relation 区（`aiApplication  AiApplication?` 行附近）加 relation 与索引：

```prisma
  model          Model?            @relation(fields: [modelId], references: [id], onDelete: SetNull)   // ★
  tools          ChatSessionTool[]    // ★
```

并在 `@@index([aiApplicationId])  // ★` 附近加：

```prisma
  @@index([modelId])               // ★
```

- [ ] **Step 2: 改 schema —— Model 加反向 relation**

在 `model Model` 的 `aiApplications AiApplication[]` 行后加：

```prisma
  chatSessions    ChatSession[]
```

- [ ] **Step 3: 改 schema —— Tool 加反向 relation**

在 `model Tool` 的 `applications AiApplicationTool[]` 行后加：

```prisma
  sessions        ChatSessionTool[]
```

- [ ] **Step 4: 新增 ChatSessionTool 模型**

在 `model AiApplicationTool` 之后、`model ChatSession` 附近新增：

```prisma
// ★ V3: 会话绑定工具（自定义/快捷模式都写到这里，仿 AiApplicationTool）
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

- [ ] **Step 5: 生成迁移 + client**

Run（从仓库根目录）：
```bash
npx prisma migrate dev --name chat_session_model_and_tools
npx prisma generate
```
Expected: 迁移目录 `prisma/migrations/<ts>_chat_session_model_and_tools/` 生成；`generate` 成功。
> 若本地无可用 DB 导致 `migrate dev` 失败：先 `npx prisma generate` 保证类型可用，迁移留到有 DB 环境执行，并如实报告。

- [ ] **Step 6: 验证类型可用**

Run: `grep -c "ChatSessionTool" node_modules/.prisma/client/index.d.ts`
Expected: ≥ 1（client 已含新模型）。

- [ ] **Step 7: Commit**

```bash
git add prisma/schema.prisma prisma/migrations
git commit -m "feat(prisma): ChatSession 增 model_id，新增 chat_session_tools 关联表"
```

---

### Task 2: 后端 DTO —— modelId + toolIds

**Files:**
- Modify: `apps/api/src/modules/chat/dto/create-session.dto.ts`

- [ ] **Step 1: 加字段**

在 `aiApplicationId?` 与 `workflowId?` 之间插入：

```typescript
  @IsString()
  @IsOptional()
  modelId?: string;

  @IsArray()
  @IsOptional()
  @IsString({ each: true })
  toolIds?: string[];
```

同时把 import 改为：

```typescript
import {
  IsString,
  MaxLength,
  IsNotEmpty,
  IsOptional,
  IsArray,
} from 'class-validator';
```

- [ ] **Step 2: 验证**

Run（apps/api）：`npx tsc --noEmit -p tsconfig.json`
Expected: 无报错。

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/modules/chat/dto/create-session.dto.ts
git commit -m "feat(chat): CreateSessionDto 增 modelId 与 toolIds"
```

---

### Task 3: SessionService.create —— 快捷快照 + 自定义 toolIds（TDD）

**Files:**
- Create: `apps/api/src/modules/chat/session.service.spec.ts`
- Modify: `apps/api/src/modules/chat/session.service.ts`

- [ ] **Step 1: 写失败测试**

创建 `apps/api/src/modules/chat/session.service.spec.ts`：

```typescript
import { SessionService } from './session.service';
import { NotFoundException } from '@nestjs/common';
import { DEFAULT_WORKFLOW_TYPE } from '@nexus/config';
import type { PrismaService } from '@nexus/database';

describe('SessionService.create', () => {
  let prisma: any;
  let service: SessionService;

  beforeEach(() => {
    prisma = {
      aiApplication: { findUnique: jest.fn() },
      workflow: { findUnique: jest.fn() },
      chatSession: { create: jest.fn() },
      chatSessionTool: { createMany: jest.fn() },
    };
    service = new SessionService(prisma as PrismaService);
  });

  it('快捷模式：把 AI 应用的绑定快照到会话，并写入 chat_session_tools', async () => {
    prisma.aiApplication.findUnique.mockResolvedValue({
      knowledgeBaseId: 'kb-app',
      workflowId: 'wf-app',
      modelId: 'model-app',
      promptTemplateId: 'pt-app',
      workflow: { type: 'rewoo' },
      tools: [{ toolId: 'tool-1' }, { toolId: 'tool-2' }],
    });
    prisma.chatSession.create.mockResolvedValue({ id: 's-1', title: 'x' });
    prisma.chatSessionTool.createMany.mockResolvedValue({ count: 2 });

    await service.create(
      { title: '会话', aiApplicationId: 'app-1' },
      'user-1',
    );

    expect(prisma.chatSession.create).toHaveBeenCalledWith({
      data: {
        title: '会话',
        userId: 'user-1',
        aiApplicationId: 'app-1',
        kbId: 'kb-app',
        workflowId: 'wf-app',
        modelId: 'model-app',
        promptTemplateId: 'pt-app',
        workflowType: 'rewoo',
      },
    });
    expect(prisma.chatSessionTool.createMany).toHaveBeenCalledWith({
      data: [
        { sessionId: 's-1', toolId: 'tool-1' },
        { sessionId: 's-1', toolId: 'tool-2' },
      ],
    });
  });

  it('快捷模式：AI 应用不存在 → NotFoundException', async () => {
    prisma.aiApplication.findUnique.mockResolvedValue(null);
    await expect(
      service.create({ title: 'x', aiApplicationId: 'missing' }, 'u'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('自定义模式：透传 kb/model/prompt/workflow，toolIds 写入 chat_session_tools，workflowType 来自所选工作流', async () => {
    prisma.workflow.findUnique.mockResolvedValue({ type: 'rewoo' });
    prisma.chatSession.create.mockResolvedValue({ id: 's-2', title: 'y' });
    prisma.chatSessionTool.createMany.mockResolvedValue({ count: 1 });

    await service.create(
      {
        title: '自定义',
        kbId: 'kb-1',
        modelId: 'model-1',
        promptTemplateId: 'pt-1',
        workflowId: 'wf-1',
        toolIds: ['tool-1'],
      },
      'user-1',
    );

    // toolIds 不应被透传到 chatSession.create（非列）
    expect(prisma.chatSession.create).toHaveBeenCalledWith({
      data: {
        title: '自定义',
        userId: 'user-1',
        kbId: 'kb-1',
        modelId: 'model-1',
        promptTemplateId: 'pt-1',
        workflowId: 'wf-1',
        workflowType: 'rewoo',
      },
    });
    expect(prisma.chatSessionTool.createMany).toHaveBeenCalledWith({
      data: [{ sessionId: 's-2', toolId: 'tool-1' }],
    });
  });

  it('自定义模式：无工作流时 workflowType 回退 DEFAULT_WORKFLOW_TYPE', async () => {
    prisma.chatSession.create.mockResolvedValue({ id: 's-3', title: 'z' });
    await service.create({ title: '简单' }, 'user-1');
    expect(prisma.chatSession.create).toHaveBeenCalledWith({
      data: { title: '简单', userId: 'user-1', workflowType: DEFAULT_WORKFLOW_TYPE },
    });
  });
});
```

- [ ] **Step 2: 运行确认失败**

Run（apps/api）：`npx jest src/modules/chat/session.service.spec --runInBand`
Expected: FAIL（`create` 尚未实现快捷快照；`chatSessionTool` 也不存在）。

- [ ] **Step 3: 实现 SessionService.create**

改 `apps/api/src/modules/chat/session.service.ts` 的 `create`：

```typescript
  async create(dto: CreateSessionDto, userId: string) {
    // 快捷模式：选 AI 应用 → 后端把应用绑定快照到会话（session 自包含）
    if (dto.aiApplicationId) {
      const app = await this.prisma.aiApplication.findUnique({
        where: { id: dto.aiApplicationId },
        select: {
          knowledgeBaseId: true,
          workflowId: true,
          modelId: true,
          promptTemplateId: true,
          workflow: { select: { type: true } },
          tools: { select: { toolId: true } },
        },
      });
      if (!app) throw new NotFoundException('AI 应用不存在');
      const session = await this.prisma.chatSession.create({
        data: {
          title: dto.title,
          userId,
          aiApplicationId: dto.aiApplicationId,
          kbId: app.knowledgeBaseId,
          workflowId: app.workflowId,
          modelId: app.modelId,
          promptTemplateId: app.promptTemplateId,
          workflowType: app.workflow?.type ?? DEFAULT_WORKFLOW_TYPE,
        },
      });
      if (app.tools.length) {
        await this.prisma.chatSessionTool.createMany({
          data: app.tools.map((t) => ({
            sessionId: session.id,
            toolId: t.toolId,
          })),
        });
      }
      return session;
    }

    // 自定义模式：手动选择 kb/workflow/model/prompt/tools
    let workflowType: string = DEFAULT_WORKFLOW_TYPE;
    if (dto.workflowId) {
      const workflow = await this.prisma.workflow.findUnique({
        where: { id: dto.workflowId },
        select: { type: true },
      });
      if (!workflow) {
        throw new NotFoundException('工作流不存在');
      }
      workflowType = workflow.type;
    }
    // toolIds 是关联表数据，不能透传到 chatSession.create
    const { toolIds, ...sessionData } = dto;
    const session = await this.prisma.chatSession.create({
      data: { ...sessionData, userId, workflowType },
    });
    if (toolIds?.length) {
      await this.prisma.chatSessionTool.createMany({
        data: toolIds.map((toolId) => ({ sessionId: session.id, toolId })),
      });
    }
    return session;
  }
```

- [ ] **Step 4: 运行确认通过**

Run（apps/api）：`npx jest src/modules/chat/session.service.spec --runInBand`
Expected: 4 个用例全 PASS。

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/modules/chat/session.service.ts apps/api/src/modules/chat/session.service.spec.ts
git commit -m "feat(chat): 会话创建支持快捷快照与自定义 toolIds"
```

---

### Task 4: ChatService.resolveTarget —— 自包含 + 旧会话回退（TDD）

**Files:**
- Modify: `apps/api/src/modules/chat/chat.service.ts`（resolveTarget）
- Modify: `apps/api/src/modules/chat/chat.service.spec.ts`

- [ ] **Step 1: 写失败测试**

在 `apps/api/src/modules/chat/chat.service.spec.ts` 的 `describe('streamMessage')` 内追加两个用例（放在文件末尾 `});` 之前）：

```typescript
    it('会话自带 modelId/kbId、无 aiApplicationId → 直接用会话字段，不再查 AI 应用', async () => {
      prisma.chatSession.findFirst.mockResolvedValue({
        id: 's',
        kbId: 'kb-1',
        modelId: 'model-1',
        promptTemplateId: null,
        aiApplicationId: null,
      });
      modelCaller.resolveChatModel.mockResolvedValue(mockModel());
      prisma.chatMessage.findMany.mockResolvedValue([]);
      prisma.chatMessage.create.mockResolvedValue({ id: 'a-1' });
      retrieval.search.mockResolvedValue({
        results: [],
        strategy: 'vector',
        totalCandidates: 0,
      });

      await drain(service.streamMessage('s', 'u', 'hi'));

      expect(prisma.aiApplication.findUnique).not.toHaveBeenCalled();
      expect(modelCaller.resolveChatModel).toHaveBeenCalledWith('model-1');
    });

    it('无 modelId 且无 aiApplicationId → error 事件提示未配置模型', async () => {
      prisma.chatSession.findFirst.mockResolvedValue({
        id: 's',
        kbId: 'kb-1',
        modelId: null,
        promptTemplateId: null,
        aiApplicationId: null,
      });

      const events = await drain(service.streamMessage('s', 'u', 'hi'));

      expect(events[events.length - 1]).toEqual({
        type: 'error',
        data: { message: '会话未配置模型' },
      });
    });
```

- [ ] **Step 2: 运行确认失败**

Run（apps/api）：`npx jest src/modules/chat/chat.service.spec --runInBand`
Expected: FAIL —— 现有 resolveTarget 在 `!session.aiApplicationId` 时抛 `'会话未绑定 AI 应用'`，两条新用例拿不到 `resolveChatModel('model-1')` / `'会话未配置模型'`。

- [ ] **Step 3: 实现 resolveTarget**

把 `apps/api/src/modules/chat/chat.service.ts` 的 `resolveTarget` 整体替换为：

```typescript
  /** 解析会话目标：归属校验 + kbId + 模型 + 系统提示词。任一失败抛错 → 上层发 error 事件 */
  private async resolveTarget(sessionId: string, userId: string) {
    const session = await this.prisma.chatSession.findFirst({
      where: { id: sessionId, userId },
      select: {
        id: true,
        kbId: true,
        modelId: true,
        promptTemplateId: true,
        aiApplicationId: true,
      },
    });
    if (!session) throw new BadRequestException('会话不存在');

    // 旧会话兼容：会话自身缺 modelId/kbId 且带 aiApplicationId → 回退 AI 应用解析
    let app:
      | {
          modelId: string;
          promptTemplateId: string | null;
          knowledgeBaseId: string | null;
        }
      | null = null;
    if ((!session.modelId || !session.kbId) && session.aiApplicationId) {
      app = await this.prisma.aiApplication.findUnique({
        where: { id: session.aiApplicationId },
        select: { modelId: true, promptTemplateId: true, knowledgeBaseId: true },
      });
      if (!app) throw new BadRequestException('AI 应用不存在');
    }

    const modelId = session.modelId ?? app?.modelId;
    if (!modelId) throw new BadRequestException('会话未配置模型');

    // kbId 优先会话自身的，其次应用默认知识库
    const kbId = session.kbId ?? app?.knowledgeBaseId;
    if (!kbId) throw new BadRequestException('会话未配置知识库');

    const model = await this.modelCaller.resolveChatModel(modelId);
    const systemPrompt = await this.resolveSystemPrompt(
      session.promptTemplateId ?? app?.promptTemplateId,
    );
    return { kbId, model, systemPrompt };
  }
```

- [ ] **Step 4: 运行确认通过**

Run（apps/api）：`npx jest src/modules/chat/chat.service.spec --runInBand`
Expected: 全 PASS（原有用例走 app 回退分支，两条新用例走自包含/报错分支）。

- [ ] **Step 5: 回归 chat 全部用例**

Run（apps/api）：`npx jest src/modules/chat --runInBand`
Expected: 全 PASS。

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/modules/chat/chat.service.ts apps/api/src/modules/chat/chat.service.spec.ts
git commit -m "fix(chat): resolveTarget 自包含解析，AI 应用仅作旧会话回退"
```

---

### Task 5: 前端类型/API + 模型/工具 composable 门控

**Files:**
- Modify: `apps/web/src/modules/models/composables/useModels.ts`
- Modify: `apps/web/src/modules/tools/composables/useTools.ts`
- Modify: `apps/web/src/modules/chat/api/chat.api.ts`
- Modify: `apps/web/src/modules/chat/types/chat.ts`

- [ ] **Step 1: useModels 加 enabled**

`apps/web/src/modules/models/composables/useModels.ts` 顶部改为：

```typescript
import { useQuery, useMutation, useQueryClient } from '@tanstack/vue-query'
import { toValue, type MaybeRef } from 'vue'
import { modelsApi } from '@/modules/models/api/model.api'

export function useModels(enabled: MaybeRef<boolean> = true) {
  return useQuery({
    queryKey: ['models'],
    queryFn: () => modelsApi.list(),
    enabled: () => toValue(enabled),
  })
}
```

- [ ] **Step 2: useTools 加 enabled**

`apps/web/src/modules/tools/composables/useTools.ts` 顶部改为：

```typescript
import { useQuery, useMutation, useQueryClient } from '@tanstack/vue-query'
import { toValue, type MaybeRef } from 'vue'
import { toolsApi } from '@/modules/tools/api/tool.api'

export function useTools(enabled: MaybeRef<boolean> = true) {
  return useQuery({
    queryKey: ['tools'],
    queryFn: () => toolsApi.list(),
    enabled: () => toValue(enabled),
  })
}
```

- [ ] **Step 3: CreateSessionPayload 加字段**

`apps/web/src/modules/chat/api/chat.api.ts` 的接口改为：

```typescript
export interface CreateSessionPayload {
  title: string
  kbId?: string
  promptTemplateId?: string
  modelId?: string
  aiApplicationId?: string
  workflowId?: string
  toolIds?: string[]
  workflowType: WorkflowType
}
```

- [ ] **Step 4: ChatSession 类型加 modelId**

`apps/web/src/modules/chat/types/chat.ts` 的 `ChatSession` 加一行：

```typescript
  modelId?: string
```

- [ ] **Step 5: 回归现有前端测试**

Run（apps/web）：`npx vitest run`
Expected: 现有用例仍 PASS（useModels/useTools 默认 enabled=true，调用方无感）。

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/modules/models/composables/useModels.ts apps/web/src/modules/tools/composables/useTools.ts apps/web/src/modules/chat/api/chat.api.ts apps/web/src/modules/chat/types/chat.ts
git commit -m "feat(web): chat 创建 payload 增 modelId/toolIds；模型/工具列表支持门控"
```

---

### Task 6: CreateSessionDialog 两模式（TDD）

**Files:**
- Modify: `apps/web/src/modules/chat/components/CreateSessionDialog.vue`
- Modify: `apps/web/src/modules/chat/__tests__/CreateSessionDialog.spec.ts`

- [ ] **Step 1: 重写失败测试**

把 `apps/web/src/modules/chat/__tests__/CreateSessionDialog.spec.ts` 整体替换为：

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises, type VueWrapper } from '@vue/test-utils'
import { defineComponent, ref } from 'vue'
import ElementPlus, { ElMessage } from 'element-plus'
import { VueQueryPlugin, QueryClient } from '@tanstack/vue-query'
import CreateSessionDialog from '../components/CreateSessionDialog.vue'

// ElSelect/ElOption/ElForm 在 jsdom + EP 2.14 下的兼容性桩件（理由见原文件注释，保持不变）
const ElSelectStub = defineComponent({
  name: 'ElSelect',
  props: {
    modelValue: { type: [String, Number, Boolean, Array], default: '' },
    disabled: { type: Boolean, default: false },
    clearable: { type: Boolean, default: false },
    filterable: { type: Boolean, default: false },
    placeholder: { type: String, default: '' },
    multiple: { type: Boolean, default: false },
  },
  emits: ['update:modelValue', 'change'],
  template: '<div class="el-select-stub"><slot /></div>',
})
const ElOptionStub = defineComponent({
  name: 'ElOption',
  props: {
    label: { type: [String, Number], default: '' },
    value: { type: [String, Number, Boolean, Object], default: '' },
  },
  template: '<div class="el-option-stub" />',
})
const ElFormStub = defineComponent({
  name: 'ElForm',
  props: {
    model: { type: Object, default: () => ({}) },
    rules: { type: Object, default: () => ({}) },
  },
  setup(props, { expose }) {
    const errorMessage = ref('')
    function validate() {
      const title = String(props.model?.title ?? '').trim()
      if (!title) {
        errorMessage.value = '请输入会话标题'
        return Promise.reject(new Error('validation failed'))
      }
      errorMessage.value = ''
      return Promise.resolve(true)
    }
    function clearValidate() {
      errorMessage.value = ''
    }
    expose({ validate, clearValidate })
    return { errorMessage }
  },
  template: '<div class="el-form"><slot /><div v-if="errorMessage" class="el-form-item__error">{{ errorMessage }}</div></div>',
})

const createSession = vi.fn()
const kbList = vi.fn()
const promptList = vi.fn()
const appList = vi.fn()
const workflowList = vi.fn()
const modelList = vi.fn()
const toolList = vi.fn()

vi.mock('@/modules/chat/api/chat.api', () => ({
  chatApi: { createSession: (...args: unknown[]) => createSession(...args) },
}))
vi.mock('@/modules/knowledge/api/knowledge.api', () => ({
  knowledgeBasesApi: { list: (...args: unknown[]) => kbList(...args) },
}))
vi.mock('@/modules/prompt/api/prompt.api', () => ({
  promptsApi: { list: (...args: unknown[]) => promptList(...args) },
}))
vi.mock('@/modules/ai-application/api/ai-application.api', () => ({
  aiApplicationsApi: { list: (...args: unknown[]) => appList(...args) },
}))
vi.mock('@/modules/workflow/api/workflow.api', () => ({
  workflowsApi: { list: (...args: unknown[]) => workflowList(...args) },
}))
vi.mock('@/modules/models/api/model.api', () => ({
  modelsApi: { list: (...args: unknown[]) => modelList(...args) },
}))
vi.mock('@/modules/tools/api/tool.api', () => ({
  toolsApi: { list: (...args: unknown[]) => toolList(...args) },
}))

function mountDialog(props: Record<string, unknown> = {}) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return mount(CreateSessionDialog, {
    props: { visible: true, ...props },
    global: {
      plugins: [ElementPlus, [VueQueryPlugin, { queryClient: qc }]],
      stubs: { teleport: true, ElForm: ElFormStub, ElSelect: ElSelectStub, ElOption: ElOptionStub },
    },
  })
}

async function setTitle(wrapper: VueWrapper, text: string) {
  await wrapper.find('input').setValue(text)
}

// 自定义模式（默认）下 el-select 顺序：0=知识库 1=提示词 2=工作流 3=模型 4=工具
// 快捷模式下顺序：0=AI 应用
async function selectValue(wrapper: VueWrapper, index: number, value: string | string[]) {
  const selects = wrapper.findAllComponents({ name: 'ElSelect' })
  selects[index].vm.$emit('update:modelValue', value)
  await flushPromises()
}

async function switchMode(wrapper: VueWrapper, mode: 'quick' | 'custom') {
  const radio = wrapper.find(`input[type="radio"][value="${mode}"]`)
  await radio.setValue(true)
  await flushPromises()
}

async function submit(wrapper: VueWrapper) {
  await wrapper.find('[data-testid="create-session-submit"]').trigger('click')
  await flushPromises()
}

describe('CreateSessionDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    createSession.mockResolvedValue({ id: 's-1', title: 'x' })
    kbList.mockResolvedValue([{ id: 'kb-1', name: '默认知识库' }])
    promptList.mockResolvedValue([{ id: 'pt-1', name: '默认提示词' }])
    appList.mockResolvedValue([{ id: 'app-1', name: '客服助手' }])
    workflowList.mockResolvedValue([{ id: 'wf-1', name: 'ReWOO 流程', type: 'rewoo' }])
    modelList.mockResolvedValue([
      { id: 'model-1', displayName: 'DeepSeek', type: 'chat' },
      { id: 'model-2', displayName: 'BGE', type: 'embedding' },
    ])
    toolList.mockResolvedValue([{ id: 'tool-1' }, { id: 'tool-2' }])
  })

  it('自定义模式（默认）：仅填标题即可创建，workflowType 默认 rag', async () => {
    const wrapper = mountDialog()
    await flushPromises()
    await setTitle(wrapper, '我的会话')
    await submit(wrapper)
    expect(createSession).toHaveBeenCalledWith({ title: '我的会话', workflowType: 'rag' })
    expect(wrapper.emitted('created')?.[0]?.[0]).toMatchObject({ id: 's-1', title: 'x' })
  })

  it('自定义模式：选模型与工具后 payload 带 modelId 与 toolIds', async () => {
    const wrapper = mountDialog()
    await flushPromises()
    await setTitle(wrapper, '带模型会话')
    await selectValue(wrapper, 3, 'model-1')
    await selectValue(wrapper, 4, ['tool-1', 'tool-2'])
    await submit(wrapper)
    expect(createSession).toHaveBeenCalledWith({
      title: '带模型会话',
      modelId: 'model-1',
      toolIds: ['tool-1', 'tool-2'],
      workflowType: 'rag',
    })
  })

  it('自定义模式：选工作流后带 workflowId 与该工作流的 type', async () => {
    const wrapper = mountDialog()
    await flushPromises()
    await setTitle(wrapper, '流程会话')
    await selectValue(wrapper, 2, 'wf-1')
    await submit(wrapper)
    expect(createSession).toHaveBeenCalledWith({
      title: '流程会话',
      workflowId: 'wf-1',
      workflowType: 'rewoo',
    })
  })

  it('快捷模式：选 AI 应用后 payload 只带 aiApplicationId', async () => {
    const wrapper = mountDialog()
    await flushPromises()
    await switchMode(wrapper, 'quick')
    await setTitle(wrapper, '应用会话')
    await selectValue(wrapper, 0, 'app-1')
    await submit(wrapper)
    expect(createSession).toHaveBeenCalledWith({
      title: '应用会话',
      aiApplicationId: 'app-1',
      workflowType: 'rag',
    })
  })

  it('标题为空时校验失败，不提交', async () => {
    const wrapper = mountDialog()
    await flushPromises()
    await submit(wrapper)
    expect(createSession).not.toHaveBeenCalled()
    expect(wrapper.find('.el-form-item__error').exists()).toBe(true)
  })

  it('prefillTitle 预填标题', async () => {
    const wrapper = mountDialog({ prefillTitle: '知识库问答' })
    await flushPromises()
    expect((wrapper.find('input').element as HTMLInputElement).value).toBe('知识库问答')
  })

  it('提交失败时弹窗保持打开、表单内容保留并提示错误', async () => {
    createSession.mockRejectedValue(new Error('boom'))
    const errorSpy = vi.spyOn(ElMessage, 'error').mockImplementation(() => ({}) as never)
    const wrapper = mountDialog()
    await flushPromises()
    await setTitle(wrapper, '失败会话')
    await submit(wrapper)
    expect(createSession).toHaveBeenCalledTimes(1)
    const visibleEmits = wrapper.emitted('update:visible')
    const closed = visibleEmits?.some((payload) => payload[0] === false) ?? false
    expect(closed).toBe(false)
    expect((wrapper.find('input').element as HTMLInputElement).value).toBe('失败会话')
    expect(errorSpy).toHaveBeenCalledWith('创建会话失败')
    errorSpy.mockRestore()
  })
})
```

- [ ] **Step 2: 运行确认失败**

Run（apps/web）：`npx vitest run src/modules/chat/__tests__/CreateSessionDialog.spec.ts`
Expected: FAIL —— 组件尚无两模式/模型/工具选择器，模式切换、modelId/toolIds 断言无法满足。

- [ ] **Step 3: 实现 CreateSessionDialog.vue**

把 `apps/web/src/modules/chat/components/CreateSessionDialog.vue` 整体替换为：

```vue
<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { ElMessage, type FormInstance, type FormRules } from 'element-plus'
import { DEFAULT_WORKFLOW_TYPE, type WorkflowType } from '@nexus/config'
import { useKnowledgeBases } from '@/modules/knowledge/composables/useKnowledge'
import { usePromptTemplates } from '@/modules/prompt/composables/usePrompts'
import { useAiApplications } from '@/modules/ai-application/composables/useAiApplications'
import { useWorkflows } from '@/modules/workflow/composables/useWorkflow'
import { useModels } from '@/modules/models/composables/useModels'
import { useTools } from '@/modules/tools/composables/useTools'
import { useCreateChatSession } from '../composables/useChat'
import type { ChatSession } from '../types/chat'
import type { CreateSessionPayload } from '../api/chat.api'

const visible = defineModel<boolean>('visible', { default: false })
const props = defineProps<{ prefillTitle?: string }>()
const emit = defineEmits<{ (e: 'created', session: ChatSession): void }>()

// 后端列表返回结构未定，按最小结构收窄（id+name；workflow 多一个 type）
interface NamedOption { id: string; name: string }
interface WorkflowOption extends NamedOption { type: WorkflowType }

// 弹窗未打开时不请求选项源
const { data: kbsData, isError: kbsError, refetch: refetchKbs } = useKnowledgeBases(visible)
const { data: promptsData, isError: promptsError, refetch: refetchPrompts } = usePromptTemplates(visible)
const { data: appsData, isError: appsError, refetch: refetchApps } = useAiApplications(visible)
const { data: workflowsData, isError: workflowsError, refetch: refetchWorkflows } = useWorkflows(visible)
const { data: modelsData, isError: modelsError, refetch: refetchModels } = useModels(visible)
const { data: toolsData, isError: toolsError, refetch: refetchTools } = useTools(visible)

const knowledgeBases = computed(() => (kbsData.value ?? []) as NamedOption[])
const promptTemplates = computed(() => (promptsData.value ?? []) as NamedOption[])
const aiApplications = computed(() => (appsData.value ?? []) as NamedOption[])
// TODO(后端 workflow 模块落地后): 核对列表项 type 字段名与此处收窄一致，否则 workflowType 会静默回退 rag
const workflows = computed(() => (workflowsData.value ?? []) as WorkflowOption[])
// 模型下拉只列对话模型（embedding/rerank 不参与对话）
const chatModels = computed(() => (modelsData.value ?? []).filter((m) => m.type === 'chat'))
// tools 模块当前类型为 Stub{id}，label 暂用 id
const tools = computed(() => toolsData.value ?? [])

const formRef = ref<FormInstance>()
// 创建方式：快捷模式 = 选 AI 应用（后端快照）；自定义模式 = 手动逐项选
type Mode = 'quick' | 'custom'
const mode = ref<Mode>('custom')
const form = reactive({
  title: '',
  aiApplicationId: '',
  kbId: '',
  promptTemplateId: '',
  modelId: '',
  workflowId: '',
  toolIds: [] as string[],
})

const rules: FormRules = {
  title: [
    { required: true, message: '请输入会话标题', trigger: 'blur' },
    { max: 512, message: '标题不能超过 512 字符', trigger: 'blur' },
  ],
}

const selectedWorkflow = computed(() => workflows.value.find((w) => w.id === form.workflowId))

const createMutation = useCreateChatSession()
const submitting = ref(false)

// 打开时重置表单并按 prefillTitle 预填；immediate 覆盖初始 visible=true 的挂载场景
watch(
  visible,
  (val) => {
    if (!val) return
    resetForm()
    formRef.value?.clearValidate()
  },
  { immediate: true },
)

// 模式切换时清空字段，避免跨模式残留
watch(mode, () => {
  resetForm()
  formRef.value?.clearValidate()
})

function resetForm() {
  form.title = props.prefillTitle ?? ''
  form.aiApplicationId = ''
  form.kbId = ''
  form.promptTemplateId = ''
  form.modelId = ''
  form.workflowId = ''
  form.toolIds = []
}

async function handleSubmit() {
  if (!formRef.value) return
  const valid = await formRef.value.validate().catch(() => false)
  if (!valid) return
  submitting.value = true
  try {
    const payload: CreateSessionPayload =
      mode.value === 'quick'
        ? { title: form.title, aiApplicationId: form.aiApplicationId, workflowType: DEFAULT_WORKFLOW_TYPE }
        : {
            title: form.title,
            ...(form.kbId ? { kbId: form.kbId } : {}),
            ...(form.promptTemplateId ? { promptTemplateId: form.promptTemplateId } : {}),
            ...(form.modelId ? { modelId: form.modelId } : {}),
            ...(form.workflowId ? { workflowId: form.workflowId } : {}),
            ...(form.toolIds.length ? { toolIds: form.toolIds } : {}),
            workflowType: selectedWorkflow.value?.type ?? DEFAULT_WORKFLOW_TYPE,
          }
    const session = await createMutation.mutateAsync(payload)
    visible.value = false
    emit('created', session)
  } catch {
    ElMessage.error('创建会话失败')
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <el-dialog
    v-model="visible"
    title="新建会话"
    width="560px"
  >
    <el-form
      ref="formRef"
      :model="form"
      :rules="rules"
      label-width="80px"
      @submit.prevent="handleSubmit"
    >
      <el-form-item
        label="标题"
        prop="title"
        required
      >
        <el-input
          v-model="form.title"
          placeholder="会话标题"
          maxlength="512"
        />
      </el-form-item>

      <el-form-item label="创建方式">
        <el-radio-group v-model="mode">
          <el-radio value="quick">
            快捷模式（AI 应用）
          </el-radio>
          <el-radio value="custom">
            自定义模式
          </el-radio>
        </el-radio-group>
      </el-form-item>

      <!-- 快捷模式：选 AI 应用，绑定（kb/workflow/model/prompt/tools）由后端快照到会话 -->
      <template v-if="mode === 'quick'">
        <el-form-item label="AI 应用">
          <el-select
            v-model="form.aiApplicationId"
            clearable
            filterable
            placeholder="选择 AI 应用"
            style="width: 100%"
          >
            <el-option
              v-for="app in aiApplications"
              :key="app.id"
              :label="app.name"
              :value="app.id"
            />
          </el-select>
          <p
            v-if="appsError"
            class="mt-1 text-xs"
            style="color: var(--el-color-error)"
          >
            AI 应用加载失败
            <el-button
              link
              type="primary"
              size="small"
              @click="refetchApps()"
            >
              重试
            </el-button>
          </p>
        </el-form-item>
      </template>

      <!-- 自定义模式：手动逐项选择 -->
      <template v-else>
        <el-form-item label="知识库">
          <el-select
            v-model="form.kbId"
            clearable
            filterable
            placeholder="选择知识库（可选）"
            style="width: 100%"
          >
            <el-option
              v-for="kb in knowledgeBases"
              :key="kb.id"
              :label="kb.name"
              :value="kb.id"
            />
          </el-select>
          <p
            v-if="kbsError"
            class="mt-1 text-xs"
            style="color: var(--el-color-error)"
          >
            知识库加载失败
            <el-button
              link
              type="primary"
              size="small"
              @click="refetchKbs()"
            >
              重试
            </el-button>
          </p>
        </el-form-item>

        <el-form-item label="提示词">
          <el-select
            v-model="form.promptTemplateId"
            clearable
            filterable
            placeholder="选择提示词模板（可选）"
            style="width: 100%"
          >
            <el-option
              v-for="pt in promptTemplates"
              :key="pt.id"
              :label="pt.name"
              :value="pt.id"
            />
          </el-select>
          <p
            v-if="promptsError"
            class="mt-1 text-xs"
            style="color: var(--el-color-error)"
          >
            提示词加载失败
            <el-button
              link
              type="primary"
              size="small"
              @click="refetchPrompts()"
            >
              重试
            </el-button>
          </p>
        </el-form-item>

        <el-form-item label="工作流">
          <el-select
            v-model="form.workflowId"
            clearable
            filterable
            placeholder="选择工作流（可选）"
            style="width: 100%"
          >
            <el-option
              v-for="wf in workflows"
              :key="wf.id"
              :label="`${wf.name}（${wf.type}）`"
              :value="wf.id"
            />
          </el-select>
          <p
            v-if="workflowsError"
            class="mt-1 text-xs"
            style="color: var(--el-color-error)"
          >
            工作流加载失败
            <el-button
              link
              type="primary"
              size="small"
              @click="refetchWorkflows()"
            >
              重试
            </el-button>
          </p>
        </el-form-item>

        <el-form-item label="模型">
          <el-select
            v-model="form.modelId"
            clearable
            filterable
            placeholder="选择对话模型（可选）"
            style="width: 100%"
          >
            <el-option
              v-for="m in chatModels"
              :key="m.id"
              :label="m.displayName"
              :value="m.id"
            />
          </el-select>
          <p
            v-if="modelsError"
            class="mt-1 text-xs"
            style="color: var(--el-color-error)"
          >
            模型加载失败
            <el-button
              link
              type="primary"
              size="small"
              @click="refetchModels()"
            >
              重试
            </el-button>
          </p>
        </el-form-item>

        <el-form-item label="工具">
          <el-select
            v-model="form.toolIds"
            multiple
            clearable
            placeholder="选择工具（可选）"
            style="width: 100%"
          >
            <el-option
              v-for="t in tools"
              :key="t.id"
              :label="t.id"
              :value="t.id"
            />
          </el-select>
          <p
            v-if="toolsError"
            class="mt-1 text-xs"
            style="color: var(--el-color-error)"
          >
            工具加载失败
            <el-button
              link
              type="primary"
              size="small"
              @click="refetchTools()"
            >
              重试
            </el-button>
          </p>
        </el-form-item>
      </template>
    </el-form>

    <template #footer>
      <el-button @click="visible = false">
        取消
      </el-button>
      <el-button
        type="primary"
        :loading="submitting"
        data-testid="create-session-submit"
        @click="handleSubmit"
      >
        创建
      </el-button>
    </template>
  </el-dialog>
</template>
```

- [ ] **Step 4: 运行确认通过**

Run（apps/web）：`npx vitest run src/modules/chat/__tests__/CreateSessionDialog.spec.ts`
Expected: 全 PASS。

- [ ] **Step 5: 回归 chat 前端测试**

Run（apps/web）：`npx vitest run src/modules/chat`
Expected: 全 PASS。

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/modules/chat/components/CreateSessionDialog.vue apps/web/src/modules/chat/__tests__/CreateSessionDialog.spec.ts
git commit -m "feat(chat): 新建会话弹窗支持快捷/自定义两模式，增模型与工具选择"
```

---

### Task 7: DATABASE.md 同步

**Files:**
- Modify: `DATABASE.md`

- [ ] **Step 1: chat_sessions 增 model_id 列说明**

在 `DATABASE.md` §4.8 chat_sessions 的表结构（`ai_application_id` 行附近）加：

```markdown
    model_id            UUID                  DEFAULT NULL,     -- 会话自带对话模型（快捷/自定义模式写入，使会话自包含）
```

并在该节的 prisma 块（`model ChatSession`）的 `aiApplicationId` 行后加一行：

```markdown
  modelId           String?  @map("model_id") @db.Uuid                          // ★ V3: 会话自带模型
```

- [ ] **Step 2: 新增 chat_session_tools 表**

在 DATABASE.md 的 `ai_application_tools` 章节后新增：

```markdown
### 4.x chat_session_tools — 会话工具绑定表 (★ V3)

| 列名 | 类型 | 说明 |
| --- | --- | --- |
| id | UUID PK | |
| session_id | UUID FK → chat_sessions.id | onDelete: Cascade |
| tool_id | UUID FK → tools.id | onDelete: Cascade |
| created_at | Timestamptz | |
| UNIQUE(session_id, tool_id) | | |

```prisma
model ChatSessionTool {
  id        String   @id @default(uuid()) @db.Uuid
  sessionId String   @map("session_id") @db.Uuid
  toolId    String   @map("tool_id") @db.Uuid
  createdAt DateTime @default(now()) @map("created_at") @db.Timestamptz()
  session   ChatSession @relation(fields: [sessionId], references: [id], onDelete: Cascade)
  tool      Tool        @relation(fields: [toolId], references: [id], onDelete: Cascade)
  @@unique([sessionId, toolId])
  @@index([sessionId])
  @@map("chat_session_tools")
}
```
```

- [ ] **Step 3: Commit**

```bash
git add DATABASE.md
git commit -m "docs: DATABASE.md 同步 chat_sessions.model_id 与 chat_session_tools 表"
```

---

### Task 8: 全量回归

- [ ] **Step 1: 后端全量单测**

Run（apps/api）：`npx jest --runInBand`
Expected: 全 PASS。

- [ ] **Step 2: 前端全量单测**

Run（apps/web）：`npx vitest run`
Expected: 全 PASS。

- [ ] **Step 3: 检查工作区状态**

Run: `git status --short`
Expected: 无未提交改动（除计划/规格文档自身若未提交）。

---

## Self-Review

**Spec coverage：**
- 快捷模式快照 kb/workflow/model/prompt/tools → Task 3（+ schema Task 1）。
- 自定义模式选择各项 → Task 3、Task 6。
- ChatSession.modelId + 表 model_id + prisma 字段 → Task 1。
- resolveTarget 无 app 也走通（移除「会话未绑定 AI 应用」）→ Task 4。
- 前端两模式弹窗 → Task 6；类型/API → Task 5。

**Placeholder scan：** 无 TBD/TODO（组件中保留的一处 `TODO(后端 workflow 模块落地后)` 为原文件既有注释，非计划占位）。

**Type consistency：** `CreateSessionDto.toolIds?: string[]`（Task 2）↔ `CreateSessionPayload.toolIds?: string[]`（Task 5）↔ 组件 `form.toolIds: string[]`（Task 6）一致；`ChatSession.modelId?: string`（Task 5）↔ 后端 prisma `modelId String?`（Task 1）一致；`session.modelId ?? app?.modelId` 与 spec 一致。
