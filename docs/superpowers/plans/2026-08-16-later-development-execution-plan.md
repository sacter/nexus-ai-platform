# NexusAI 后期开发执行计划（V2 → V6）

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在已落地的 V1（知识库 + 检索 + 模型 + 索引 Worker）基础上，按「Chat 优先」原则补齐 V2 应用编排层（详细可执行），并为 V3–V6（Agent 平台 → 企业级 → 知识图谱 → MCP/Multi-Agent）提供里程碑级路线图。

**Architecture:** 延续现有 monorepo（`apps/api` NestJS + `apps/web` Vue3 + `apps/worker` BullMQ + `packages/@nexus/*`）。V2 的骨干是「LLM 生成层（新增，@nexus/ai-core）→ Chat 模块（SSE）→ 基础模块补齐（job/audit/settings/prompt）→ Workflow 执行引擎 → AI Application 装配层 → 前端接线 + Dashboard」。所有新 API 走 `/api/v1` 全局前缀；审计、会话锁、密钥解密作为横切能力被各模块复用。

**Tech Stack:** NestJS 11、Prisma（PostgreSQL + pgvector，23 表已建）、BullMQ + Redis、SSE（`@sse` + `Observable`）、`@nexus/ai-core`（新增 chat provider）、`@nexus/model-config`、Vue 3 + TanStack Query + Element Plus。

---

## 0. 现状基线（2026-08-16 核对）

### 0.1 已完成（真实可用）

| 层 | 内容 |
|---|---|
| API | auth（RSA 登录/验证码/限流）、user、api-key（AEAD 加密存储）、knowledge-base、document（上传/版本/软删/重索引）、permission（RBAC）、chunk（只读分页）、version、**model（V2 模型中心，近期完成）**、retrieval（Dense+Sparse+RRF+Reranker+Citation+Redis 缓存） |
| Worker | index / embedding / reindex / delete-chunks / cleanup 队列；Loader：PDF / Markdown / Text |
| Web | 知识库/文档/模型/API Key 页面完整；router 已定义 16 个路由 |
| Schema | DATABASE.md 的 V1–V3 **23 张表全部落地**，含 12 枚举 |

### 0.2 关键差距（本次计划要补的）

| # | 差距 | 现状 |
|---|---|---|
| G1 | **无 LLM 生成层** | `@nexus/ai-core` 只有 embedding，Chat 无法调用任何对话模型（**最高优先级前置**） |
| G2 | **chat 模块缺失** | Prisma 有 `ChatSession/ChatMessage`，前端有页面，后端无模块，全部 404；`SessionLockService` 已写好未接线 |
| G3 | **基础模块缺失** | job / audit-logs / settings / prompt 四个后端模块不存在（前端已写调用） |
| G4 | **workflow 模块缺失** | Prisma 有 `Workflow/Node/Edge/Execution`，无后端；前端 Designer 是空画布、run 是 TODO |
| G5 | **ai-application 缺失** | Prisma 有 `AiApplication/AiApplicationTool`，无后端；前端无创建页（死链 `/ai-applications/new`） |
| G6 | **tool 是 stub** | `ToolModule` 未注册、Service 返回占位字符串、controller 用 `+id`（UUID→NaN 类型错误） |
| G7 | **Dashboard 硬编码** | `GET /dashboard` 不存在，前端 stats 写死 |
| G8 | **死链/占位** | `/workflows/new`、`/chat/new` 路由未定义；prompt 新建/编辑按钮无 @click |
| G9 | **storage 空壳** | `StorageModule` 未注册、无路由方法 |
| G10 | **已知 bug** | PDF 入库 mimeType 误存为 `application/msword` |

### 0.3 横切注意事项（所有任务都要遵守）

- **@nexus/\* 包经 dist 消费**：改 `packages/*` 源码后必须 `pnpm --filter <pkg> build`，API 侧 `import` 仍指向 `dist`（Node 24 下 src TS 无法在 dev 解析）。见 [[packages-consumed-via-dist]]。
- **审计横切**：V2 各写操作（chat 发送、workflow run、ai-app 创建等）按 `AuditLog` 枚举接入审计写入；audit 模块本身在 P3 先落查询接口。
- **密钥解密仅服务端**：api-key 的 AES-GCM 解密只能在 API 进程内完成，绝不能下发前端。
- **RLS 未启用**：schema 未落 RLS 策略，P3 之前不引入，避免阻塞；如需多租户（V4）再启用。
- **提交规范**：现有 history 用 `feat: xxx` / `fix: xxx` / `docs: xxx`（中文描述），保持风格。

---

## 1. V2 应用编排层（详细执行计划，Chat 优先）

> 阶段划分：**P1 LLM 生成层 → P2 Chat → P3 基础模块 → P4 Workflow → P5 AI Application → P6 前端+Dashboard**。
> P1–P3 给出逐任务清单；P4–P6 给出任务级清单 + 关键设计。执行时每个 Task 按 writing-plans 粒度再拆为「写失败测试 → 跑失败 → 实现 → 跑过 → commit」。

### P1：LLM 生成能力层（Chat 直接前置）

**目标**：让 API 进程能按 `models` 表 + 解密后的 `api_keys` 调用对话模型，支持流式与普通两种调用。核心设计：**provider 是协议不是厂商**——默认 openai-compatible 协议，`baseUrl/apiKey/model/参数` 全部由 DB 数据驱动，代码不写死厂商；纯协议 client 放 ai-core，DB 编排留 api（谁使用谁负责）。对齐现有 embedding Provider 抽象模式。

**Task 1.0：重构 —— model-provider 并入 embedding/（配置解析能力内聚）**

> 理由：`model-provider/` 只承载 embedding 模型配置解析（`ModelProviderService.resolveEmbeddingConfig`），`EmbeddingService` 是唯一消费者；且即将新增平行的 `chat-provider/`，避免顶层出现「一个叫 model、一个叫 chat」的不对称命名。把配置解析并入 `embedding/`，顶层能力目录收敛为 `embedding/` + `chat-provider/` 两个。这是纯重构，无行为变化。

**Files:**
- Move: `packages/ai-core/src/model-provider/model-provider.ts` → `packages/ai-core/src/embedding/model-config.ts`
- Move: `packages/ai-core/src/model-provider/model-provider.service.ts` → `packages/ai-core/src/embedding/config.service.ts`（类名 `ModelProviderService` → `EmbeddingConfigService`）
- Delete: `packages/ai-core/src/model-provider/model-provider.module.ts`（`@Global` 独立模块取消，能力并入 `EmbeddingModule`）与整个 `model-provider/` 目录
- Modify: `packages/ai-core/src/embedding/embedding.module.ts` —— `providers`/`exports` 增加 `EmbeddingConfigService`
- Modify: `packages/ai-core/src/embedding/embedding.service.ts` —— import 改为 `./config.service.js` + `./model-config.js`，注入类型改为 `EmbeddingConfigService`
- Modify: `packages/ai-core/src/index.ts` —— 导出 `EmbeddingConfigService`（替换 `ModelProviderService`/`ModelProviderModule`）；`isEmbeddingProviderName/parseModelName/resolveKnownModel/EmbeddingProviderName/EmbeddingModelConfig` 改从 `./embedding/model-config.js` 导出
- Modify: `apps/api/src/app.module.ts` —— 移除 `ModelProviderModule` 的 import 与注册（约第 11、60 行）
- Modify: `apps/worker/src/app.module.ts` —— 移除 `ModelProviderModule` 的 import 与注册（约第 8、51 行）
- Modify: `apps/worker/src/worker/pipelines/index-pipeline.ts` —— `ModelProviderService` → `EmbeddingConfigService`（约第 12、53 行）

- [ ] **Step 1: 移动 + 重命名 + 改内部引用**
  把三个文件移入 `embedding/`，重命名类/模块符号，更新 `embedding.service.ts`、`index.ts` 的 import/export。**同一 commit 内改完 api/worker 的三处引用**，否则改完 ai-core 后 api/worker 编译即断（`ModelProviderService`/`ModelProviderModule` 符号消失）。
- [ ] **Step 2: 重建 ai-core 并验证无类型错误**
  Run: `pnpm --filter @nexus/ai-core build && pnpm --filter apps/api build && pnpm --filter apps/worker build`
  Expected: 三处全部通过；`@nexus/ai-core` 产出 `dist/embedding/config.service.js` 与 `dist/embedding/model-config.js`。
- [ ] **Step 3: 确认行为不变**
  跑 ai-core / 相关单测（若有），重点确认 `EmbeddingService` 注入正常、worker 索引仍能取到 embedding 配置。
- [ ] **Step 4: Commit**
  `refactor(ai-core): model-provider 并入 embedding，取消 ModelProviderModule`

**Task 1.1：定义 ChatProvider 协议接口（认协议，不认厂商）**

- Create: `packages/ai-core/src/chat-provider/chat-provider.interface.ts`
- Create: `packages/ai-core/src/chat-provider/index.ts`，并在 `packages/ai-core/src/index.ts` 导出

```ts
// chat-provider.interface.ts
export type ChatRole = 'system' | 'user' | 'assistant';

export interface ChatMessage {
  role: ChatRole;
  content: string;
}

/**
 * 协议名：wire format，不是厂商。
 * openai-compatible 是默认协议（DashScope 兼容模式/DeepSeek/Kimi/智谱/Ollama 兼容端点均兼容），
 * 绝大多数 models.provider 都走它，差异全在 baseUrl/apiKey/model/参数（数据驱动）。
 * 只有协议真不同的厂商（如某家原生接口非 OpenAI 兼容）才新增协议名 + client 实现。
 */
export type ChatProtocol = 'openai-compatible' | 'ollama-native';

/**
 * 统一入参面 —— 所有消费者共用一个请求对象，字段全部可选，按需填充。
 * 只放"现在确实有消费者"的参数（YAGNI）；V3 工具调用 / V5 实体抽取
 * 需要 JSON 模式时再加 responseFormat。
 */
export interface ChatRequest {
  model: string;              // 模型名（来自 models.modelName，如 qwen-plus）
  messages: ChatMessage[];
  /** 是否流式；默认 false。Chat=true，Summary/自查=false */
  stream?: boolean;
  /** 客户端断开 / 超时中断。只有 Chat 需要 */
  signal?: AbortSignal;
  /** 生成控制，来自 models.config（data-driven） */
  temperature?: number;
  maxTokens?: number;
  /** ★ 每个模型 config 不同 → 从 models.config 读出后透传，接口不枚举 */
  vendorParams?: Record<string, unknown>;
}

export interface ChatChunk {
  /** 增量文本；缺省表示该事件不含文本（如 thinking/结束） */
  delta?: string;
  /** 结束标记 */
  done: boolean;
  /** 本次增量可选的 usage 快照 */
  usage?: { promptTokens?: number; completionTokens?: number; totalTokens?: number };
}

/**
 * 统一对话 Provider 抽象：换协议/换厂商不改业务代码。
 * 设计决策：stream() 是唯一原始方法；complete() 是它的薄包装（聚合增量），
 * 非流式场景（Summary/自查/实体抽取）直接拿整段，不维护第二套 HTTP 解析路径。
 */
export interface ChatProvider {
  readonly protocol: ChatProtocol;
  /** 流式对话，逐 chunk 产出 */
  stream(req: ChatRequest): AsyncGenerator<ChatChunk>;
  /** 非流式对话，返回完整文本（内部实现：累加 stream() 的 delta） */
  complete(req: ChatRequest): Promise<{ content: string; usage?: ChatChunk['usage'] }>;
}
```

#### 设计决策：协议 vs 厂商（为什么不在代码里写死 openai/ollama）

模型的来源是 `models` 表（模型中心统一注册），`provider` 是**数据不是代码**：

- **默认协议 = openai-compatible**：`baseUrl`（DashScope 兼容端点 / DeepSeek / Kimi 等）、`apiKey`、`model`、参数全部来自 DB，client 不感知厂商。
- **可拓展性**：换厂商/换模型 = 改 DB 数据，不改代码；只有协议真不同才新增 client。
- **参数面**：通用参数（temperature/maxTokens）+ `vendorParams` 透传（回答"每个模型参数不同"）。

#### 设计决策：参数面（入参 → 消费者）

不同消费者对"怎么调、要什么返回"要求不同，因此入参全部可选，谁用谁填：

| 入参 | 需要它的消费者 | 为什么 |
|---|---|---|
| `stream: true` | Chat | 打字机效果 |
| `stream: false`（默认） | Summary / 反思自查 / AI 应用 test / Workflow LLM 节点 | 只要整段结果 |
| `signal` | Chat | 客户端断开立即中断，省 token |
| `temperature` / `maxTokens` | Chat、Workflow LLM 节点 | 来自 models.config |
| `vendorParams` | 任意带模型特有参数的场景 | 每个模型参数不同，透传不写死 |
| `messages` | 所有 | 对话本身 |

**要点：**
- **不建两条平行路径**——`stream()` 是唯一实现，`complete()` 只做聚合。换入参，不换代码路径。
- **协议归一化在 client 内部**——上层永远只填统一 `ChatRequest`；openai-compatible（`temperature`/`max_tokens`）与 ollama-native（`options.temperature`）的字段差异由各自 client 消化。
- **YAGNI**——`responseFormat: json` 目前无消费者，不预先加进接口；等 V3 工具调用 / V5 实体抽取真需要时再加。

**Task 1.2：OpenAI 兼容协议 client（默认）**

- Create: `packages/ai-core/src/chat-provider/clients/openai-compatible.client.ts`

实现要点：
- 用原生 `fetch`（Node 18+）调 `{baseUrl}/chat/completions`，`stream: true` 时解析 SSE `data: {...}` 行，遇到 `[DONE]` 结束。
- 构造时接收 `{ baseUrl, apiKey }`；`baseUrl` 来自 DB（`models.api_key.base_url`），**不写死 `api.openai.com`**——它是"OpenAI 兼容"协议的实现，不是"OpenAI 厂商"的实现。
- `vendorParams` 直接透传到请求体（每个模型特有参数）。
- `complete()` 复用 `stream()`，把增量拼接后返回（DRY）。

**Task 1.3：Ollama 原生协议 client（可选，按需再建）**

- Create: `packages/ai-core/src/chat-provider/clients/ollama-native.client.ts`

实现要点：Ollama 原生 `/api/chat`（`stream:true` 返回 JSON 行），字段与 OpenAI 不同（`message: {role, content}`），在 client 内归一化为 `ChatChunk`。**注意**：Ollama 也暴露 OpenAI 兼容端点，通常 `models.provider='ollama'` 时直接用 Task 1.2 即可；只有明确要走原生接口才建此类。

**Task 1.4：ChatProviderService 工厂（默认 OpenAI 兼容，按协议分派）**

- Create: `packages/ai-core/src/chat-provider/chat-provider.service.ts`

```ts
export interface ChatProviderOptions {
  /** 协议（wire format）；缺省按 openai-compatible 处理 */
  protocol?: ChatProtocol;
  baseUrl: string;   // 来自 DB：models.api_key.base_url
  apiKey?: string;
}

/** 按协议返回 client；未知/缺省一律走 openai-compatible（覆盖绝大多数厂商） */
export function createChatProvider(opts: ChatProviderOptions): ChatProvider {
  return opts.protocol === 'ollama-native'
    ? new OllamaNativeChatClient({ baseUrl: opts.baseUrl })
    : new OpenAiCompatibleChatClient({ baseUrl: opts.baseUrl, apiKey: opts.apiKey });
}
```

**Task 1.5：单元测试 + 构建**

- Test: `packages/ai-core/src/chat-provider/chat-provider.spec.ts`（mock `fetch`：openai-compatible 流式/非流式、vendorParams 透传、AbortSignal 中断；ollama-native 行解析）
- 构建：`pnpm --filter @nexus/ai-core build`，确认 `dist/chat-provider/*` 产出。
- Commit：`feat(ai-core): chat provider 协议抽象 + openai-compatible/ollama-native client`

**Task 1.6：API 侧「模型→凭证→协议参数」解析链（谁使用谁负责）**

> 放置原则：DB 查询（models/api_keys）、密钥解密、参数组装属于 API 进程职责，放 api；ai-core 只提供纯协议 client。

- Modify: `apps/api/src/modules/api-key/api-key.service.ts` —— 暴露服务端内部方法 `decryptSecret(id): Promise<string>`（用现有 nonce/tag AEAD 逆过程），并注明「仅服务端调用，不进 DTO/响应」。
- Create: `apps/api/src/modules/model/model-caller.service.ts` —— `resolveChatModel(modelId: string): Promise<{ client: ChatProvider; modelName: string }>`：查 `models`（type=chat）→ 取其 `apiKeyId` → `decryptSecret` → 从 `models.config` 读 `temperature/maxTokens/vendorParams` → `createChatProvider({ protocol, baseUrl, apiKey })`。`protocol` 由 `models.provider` 映射（默认 openai-compatible）。
- Create: `apps/api/src/modules/model/model-caller.service.spec.ts`（mock Prisma + ApiKeyService）。
- Commit：`feat(api): 模型→凭证→协议参数解析链`

**P1 验收**：`@nexus/ai-core` 能按 openai-compatible 协议流式/非流式调用（baseUrl/apiKey/参数全部由 DB 提供，代码零厂商写死）；API 进程能凭 modelId 组装出可用的 ChatProvider + 完整请求参数。

---

### P2：Chat 模块（核心 RAG 对话）

**目标**：接通「会话管理 + RAG 上下文 + LLM 流式 + SSE 协议 + 会话锁 + 反馈」，复刻 ARCHITECTURE.md §4.6 与 DATABASE.md 对话链路。

**SSE 协议（五类事件，与 ARCHITECTURE.md 对齐）**：

```text
data: {"type":"step","data":{"step":"retrieval"}}        // 阶段提示（检索/生成）
data: {"type":"citations","data":[{...引用}]}              // 引用（可选，由检索返回）
data: {"type":"delta","data":{"content":"增量文本"}}        // 生成增量
data: {"type":"error","data":{"message":"..."}}            // 错误
data: {"type":"done","data":{"messageId":"...","usage":{...}}}
```

**Task 2.1：ChatModule 骨架 + 注册**

- Create: `apps/api/src/modules/chat/chat.module.ts`、`chat.controller.ts`、`chat.service.ts`、`dto/`、`entities/`
- Modify: `apps/api/src/app.module.ts` —— 注册 `ChatModule`。
- `ChatModule` imports：`PrismaModule`、`RetrievalModule`（复用 `RetrievalService`）、`ModelModule`（复用 `ModelCallerService`）、`CommonModule`（`SessionLockService`）。
- Commit：`feat(chat): 模块骨架注册`

**Task 2.2：会话 CRUD**

- 端点：`POST /chat/sessions`（body：`kbId?`/`aiApplicationId?`/`title?`）、`GET /chat/sessions`（列表分页，含最近消息预览）、`GET /chat/sessions/:id/messages`（历史分页）、`DELETE /chat/sessions/:id`。
- Service 逻辑：创建会话时若带 `aiApplicationId`，从 `AiApplication` 解析 `kbId/workflowId/modelId/promptTemplateId`（同 ARCHITECTURE.md §4.9）；校验当前用户对该 KB 的 `kb_permissions`。
- dto 用 `class-validator`（对齐现有模块风格）。
- Commit：`feat(chat): 会话 CRUD + AI 应用装配解析`

**Task 2.3：发送消息（SSE 流式主链路）**

- 端点：`POST /chat/sessions/:id/messages`，controller 用 `@Sse()` 返回 `Observable<MessageEvent>`。
- Service 流程：
  1. `SessionLockService.acquire(sessionId)`，失败抛 `HttpException(429, '会话处理中，请稍候')`；`finally` 中 `release`。
  2. 解析会话目标（kbId / modelId）→ 失败事件兜底。
  3. `retrieval.search({kbId, query, ...})` 取上下文（失败不阻断，降级为纯 LLM）。
  4. 组装 messages：system（检索结果 + 角色设定，含引用标注）+ 最近 N 条历史（tokens 预算内）。
  5. `provider.stream(...)`，逐 chunk 推 `delta`；AbortController 监听客户端断开。
  6. 完成后落库 `chat_messages`（role=user + role=assistant，`citations` JSONB、`prompt/completion/total_tokens`）。
  7. 依次发 `step → citations → delta* → done`。
- **接上 SessionLockService（[[keep-session-lock-service]]：此处是它等到的端点）。**
- Commit：`feat(chat): 发送消息 SSE 流式 + 会话锁`

**Task 2.4：用户反馈**

- 端点：`POST /chat/messages/:id/feedback`（body：`{ action: 'like' | 'dislike', comment? }`）→ 写 `chat_messages.metadata`。
- Commit：`feat(chat): 消息反馈`

**Task 2.5：Chat 前端接线**

- Modify: `apps/web/src/modules/chat/` —— `ChatList.vue`/`ChatSession.vue`/`useChat.ts` 对接真实 API；SSE 用 `fetch` + `ReadableStream` 解析五类事件（或用 `EventSource` + 已存在的本地协议）。
- Modify: `apps/web/src/router/index.ts` —— 新增 `/chat/new` 路由（新建会话）。
- 修复死链：`handleNew()` 指向 `/chat/new`。
- Commit：`feat(web): Chat 页面接入 SSE`

**Task 2.6：Chat 测试**

- Test: `apps/api/src/modules/chat/chat.service.spec.ts`（mock RetrievalService + ChatProvider + SessionLockService：正常流式、锁冲突 429、检索降级、token 落库）。
- Commit：`test(chat): 核心链路单测`

**P2 验收**：浏览器中新建会话 → 提问 → 流式回复含 citations → 可反馈；快速连点发送返回 429；会话历史可翻看。

---

### P3：基础模块补齐（job / audit / settings / prompt）

**目标**：消灭 4 个 404 页面，并让审计成为横切写能力。

**Task 3.1：jobs 模块**

- Create: `apps/api/src/modules/job/job.module.ts`、`job.controller.ts`、`job.service.ts`
- 端点：`GET /jobs`（分页 + 按 documentId/kbId/status 筛选）、`GET /jobs/:id`、`POST /jobs/:id/cancel`、`POST /jobs/:id/retry`（复用 `IndexJob.bizId` 幂等防重）。
- Modify: `apps/api/src/app.module.ts` 注册；前端 `knowledge/api/job.api.ts` 已匹配，无需改前端。
- Commit：`feat(api): jobs 模块`

**Task 3.2：audit-logs 模块**

- Create: `apps/api/src/modules/audit-log/audit-log.module.ts`、`controller/service`（查询 + 筛选：user/action/entityType/kbId/时间范围，分页）。
- 写入口：新建 `AuditService`（或并入该模块）提供 `record({action, entityType, entityId, kbId?, details?})`，在 Chat 发送、文档软删、权限变更、模型增删改等关键操作处调用（可在 P2–P5 各模块推进时逐步接入，审计模块先落查询）。
- Commit：`feat(api): audit-logs 模块 + record 能力`

**Task 3.3：settings 模块**

- Create: `apps/api/src/modules/settings/settings.module.ts`、`controller/service`
- 端点：`GET /settings`、`PUT /settings`（单行 `system_settings.config` JSONB，校验 siteName/defaultModel 等白名单 key）。
- Commit：`feat(api): settings 模块`

**Task 3.4：prompt 模块**

- Create: `apps/api/src/modules/prompt/prompt.module.ts`、`controller/service`（含 `prompt-template-version` 子资源）
- 端点：`GET/POST /prompt-templates`、`GET/PATCH/DELETE /prompt-templates/:id`、`GET /prompt-templates/:id/versions`；**PATCH 时自动创建新版本**（`version_number + 1`，`current_version_id` 指向新版本，`is_active=true`）——对齐 DATABASE.md `prompt_templates` 设计。
- 前端 `PromptList.vue`：补「新建/编辑」@click + 表单弹窗。
- Commit：`feat(api): prompt 模板 + 版本化` / `feat(web): 提示词新建/编辑`

**P3 验收**：`/jobs`、`/settings`、`/audit-logs`、`/settings/prompts` 四个页面有真实后端，前端零 404；PATCH 提示词自动生成新版本。

---

### P4：Workflow 执行引擎

**目标**：实现 `workflows` + nodes/edges 读写与 `workflow_executions` 执行记录，策略模式跑 RAG/Reflection（ReWoo/Multi-Agent 打桩留给 V4.5）。

**Task 4.1：workflows CRUD（含图）**

- Create: `apps/api/src/modules/workflow/`（module/controller/service/dto）
- 端点：`GET/POST /workflows`、`GET/PATCH/DELETE /workflows/:id`；POST/PATCH 接受嵌套 `nodes[]`/`edges[]`（事务写入 `workflow_nodes`/`workflow_edges`，含 `position_x/position_y`、`source_handle/target_handle`——为 V3 Designer 复用）。
- 端点：`GET /workflows/:id/executions`、`GET /workflows/:id/executions/:execId`。
- Commit：`feat(api): workflows CRUD + 图结构`

**Task 4.2：执行 + 策略工厂**

- Create: `apps/api/src/modules/workflow/strategies/workflow-strategy.interface.ts`：

```ts
export interface WorkflowStrategy {
  type: 'rag' | 'reflection' | 'rewoo' | 'multi_agent';
  run(ctx: WorkflowExecutionContext): AsyncGenerator<WorkflowStepEvent>;
}
```

- Create: `workflow-strategy.factory.ts`（按 `workflow.type` 分派；`rag` 走「检索+LLM」，`reflection` 走「生成→自查→修正」；`rewoo`/`multi_agent` 抛「未实现，预留」）。
- `POST /workflows/:id/run`：创建 `WorkflowExecution`（status=RUNNING）→ 策略 `run()` → 逐节点写 `node_steps` → COMPLETED/FAILED；支持流式步进事件。
- `POST /workflows/:id/executions/:execId/resume`：断点恢复（读 `node_steps`），为 Human-in-the-loop 预留（PAUSED/WAITING）。
- Commit：`feat(api): workflow 执行 + 策略工厂`

**Task 4.3：前端接线**

- Modify: `apps/web/src/modules/workflow/` —— `WorkflowList.vue` 的 `handleExecute` 接 `/run`；新增 `/workflows/new` 路由与创建表单（先做「列表 + 基本信息」创建，Designer 拖拽属 V3）。
- Commit：`feat(web): workflow 列表执行接线`

**P4 验收**：可创建带 rag 策略的 workflow、可 run 并在 executions 看到节点步骤与耗时；Reflection 策略可跑通生成→自查。

---

### P5：AI Application 装配层

**目标**：把 KB + Workflow + Model + Prompt + Tools 打包成产品形态，`chat_sessions` 通过 `ai_application_id` 自动解析（P2 已接）。

**Task 5.1：ai-applications CRUD + 绑定**

- Create: `apps/api/src/modules/ai-application/`
- 端点：`GET/POST /ai-applications`、`GET/PATCH/DELETE /ai-applications/:id`；body 含 `knowledgeBaseId/workflowId/modelId/promptTemplateId`（外键 Restrict 校验）。
- `ai_application_tools` 关联：`POST /ai-applications/:id/tools`、`DELETE /ai-applications/:id/tools/:toolId`（config 覆盖）。
- 端点：`POST /ai-applications/:id/test`（调 ModelCallerService 试跑，返回首段输出）。
- Commit：`feat(api): ai-application 装配层`

**Task 5.2：前端接线**

- Modify: `apps/web/src/modules/ai-application/` —— `AppList.vue` 接创建/详情；新增 `/ai-applications/new` 路由 + 创建表单（选 KB/Model/Prompt）。
- Commit：`feat(web): ai-application 创建/详情`

**P5 验收**：创建应用 → 在 Chat 新建会话选择该应用 → 自动带出 KB/模型并完成 RAG 对话。

---

### P6：前端接线收尾 + Dashboard

**Task 6.1：tool 模块从 stub 转真实 CRUD**

- Modify: `apps/api/src/modules/tool/` —— `tool.service.ts` 接 Prisma（`tools` 表 + `security` JSONB）；修 `tool.controller.ts` 的 `+id`（改 `@Param('id', ParseUUIDPipe)`）；`entities/tool.entity.ts` 补字段；注册 `ToolModule` 到 `app.module.ts`。
- Modify: `apps/web/src/modules/tools/views/ToolList.vue` —— 「添加工具」补 @click + 创建表单。
- 说明：Tool **执行**（SQL/HTTP/Search 沙箱）属 V3；V2 只做注册/管理。
- Commit：`feat(api+web): tool 注册管理`

**Task 6.2：Dashboard 真实统计**

- Create: `apps/api/src/modules/dashboard/dashboard.module.ts`、`controller/service`：`GET /dashboard` 返回 `{kbCount, documentCount, chunkCount, appCount, modelCount, toolCount, recentChats[]}`（aggregate Prisma count，recentChats 取最近 5 条 session+message）。
- Modify: `apps/web/src/modules/dashboard/views/Dashboard.vue` —— 删除硬编码 stats，接真实接口。
- Commit：`feat: dashboard 统计`

**Task 6.3：storage 空壳 + mimeType bug**

- 清理：移除或接线 `apps/api/src/infrastructure/storage/`（若 upload 已走 minio-sts 直传则删除空壳，避免误导）。
- 修复 PDF mimeType：`apps/worker` 索引入库处将 `application/msword` 修正为 `application/pdf`（worker/claude.md 已记录该问题）。
- Commit：`fix(worker): pdf mimeType` / `chore(api): 清理 storage 空壳`

**P6 验收**：侧边栏 11 个入口全部可点、无 404、无死链；Dashboard 显示真实数字。

---

## 2. V3 Agent 平台（里程碑级）

> 阶段目标：让系统从「应用编排」升级为「可执行工具的平台」。前置：V2 全部落地（尤其 P4 Workflow 引擎）。

| 里程碑 | 内容 | 依赖/备注 |
|---|---|---|
| M1 Tool Center 执行 | SQL（只读+行数限制+5s 超时）、HTTP（白名单域名+TLS+10s）、Search（委托 Tavily/SerpAPI）、Function（内置）；`tool-exec` 队列 + 独立沙箱 Worker | 复用 P4 工作流节点 `tool`；V2.5 已完成注册管理 |
| M2 Workflow Designer | Vue Flow 拖拽编辑器（`@vue-flow/core` 已在技术栈清单），读写 nodes/edges（复用 `position_x/y`、`source/target_handle`），画布→保存→run | 复用 P4.1 图结构读写 |
| M3 多格式 Loader | Word / Excel / HTML Loader 接入 index pipeline（LangChain Loader 风格） | 对齐 DATABASE.md「V2.5」 |
| M4 OCR | `ocr` 队列 + Tesseract/Vision，图片 PDF 转文本后走索引 | 架构图标「V3」 |
| M5 MCP Gateway | `mcp_servers` 表（V6 规划表提前）→ MCP 服务注册 + 工具暴露 | 与 V6 重叠，可延后 |

**M 级验收**：Workflow Designer 里拖一个 SQL 工具节点 → run → 在 executions 看到工具结果；上传 Word/Excel 可索引可检索。

---

## 3. V4 企业级（里程碑级）

> 前置：V3 完成。核心是**治理与可观测**。

| 里程碑 | 内容 | 备注 |
|---|---|---|
| M1 多租户 + RLS | 启用 PostgreSQL RLS 策略（schema 0.3 提到的能力），租户级数据隔离 | 需要把 `created_by/user_id` 体系升级为 tenant_id |
| M2 SSO/OIDC | 企业 SSO 登录（OIDC/SAML），与现有 JWT 打通 | auth 模块扩展 |
| M3 计费/配额 | Token 计量（`chat_messages` 的 tokens 字段已就绪）+ 用量查询 | DATABASE.md 已预留字段 |
| M4 可观测性 | 日志聚合（Pino → 集中式）、指标（retrieval 延迟/召回率）、告警 | Event Bus 可升级 RabbitMQ/Kafka（架构图「二/三阶段」） |

---

## 4. V5 知识图谱（里程碑级）

> 前置：V4. 需新增 `entities`、`relations` 表（或引入 Neo4j/NebulaGraph），DATABASE.md §9 已规划。

| 里程碑 | 内容 |
|---|---|
| M1 实体抽取 | 文档摄入时经 LLM/规则抽取实体与关系入库（`entities`/`relations`） |
| M2 图谱检索 | RAG 检索叠加图路径检索（一跳/多跳邻居），结果作为上下文补充 |
| M3 图谱可视化 | 前端展示知识图谱（D3/ECharts graph） |

---

## 5. V6 MCP + Multi-Agent（里程碑级）

> 前置：V5 可选。DATABASE.md §9 规划 `agent_logs`、`agent_tasks`、`mcp_servers` 三张新表 + `workflows.type` 扩展 `tool_calling`/`mcp_agent`。

| 里程碑 | 内容 |
|---|---|
| M1 MCP 服务注册 | `mcp_servers` 表 + 注册/健康检查，工具经 MCP 暴露 |
| M2 Multi-Agent 运行时 | ReWOO / Multi-Agent 策略补全（P4 工厂已留位）、`agent_logs`/`agent_tasks`、Agent 编排（LangGraph） |
| M3 Tool Marketplace | 工具市场、发布/订阅 |

---

## 6. 依赖与风险

| 风险 | 说明 | 缓解 |
|---|---|---|
| LLM 层是全新能力 | 无任何对话调用先例，SSE 与流式解析是最大不确定点 | P1 默认 openai-compatible 协议（baseUrl 由 DB 提供，覆盖绝大多数厂商，Ollama 走兼容端点）；先写 mock 单测 |
| 密钥解密链路 | AEAD 解密只在 API 侧，model-caller 需谨慎处理 | 解密结果不落日志、不返回 DTO；单测覆盖 |
| SSE 与 AbortController | 客户端断开需及时中断上游 LLM 流，避免 token 浪费 | Task 2.3 显式监听 close 事件 |
| @nexus 包 dist 消费 | 改 ai-core 后忘记 build 会拿到旧产物，难排查 | 0.3 横切注意事项 + CI 或 dev 脚本前置 build |
| P4 策略复杂度 | ReWoo/Multi-Agent 复杂度高 | V2 只落地 rag/reflection，其余打桩抛「未实现」 |
| 前端已有页面与后端契约漂移 | 前端 useChat/api 可能含未确认的字段假设 | 每个模块先读前端 `api/*.ts` 与 `types/*`，后端契约以其为准回填 |

---

## 7. 建议启动方式

1. **先跑 P1**（LLM 层）——它是 Chat 的唯一硬前置，独立可交付。
2. 按 **P2 → P3 → P4 → P5 → P6** 顺序执行；每阶段一个 feature 分支，走 subagent-driven-development。
3. V3–V6 里程碑不急于开工；建议在 P6 完成后，根据实际用户反馈决定优先级（尤其 Designer 与 Tool Center 之间）。
