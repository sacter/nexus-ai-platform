# Chat 前端优化设计（对齐 SSE 契约）

> **状态**: 设计稿，待实现。`apps/web/src/modules/chat/` 前端优化。
> **来源文档**: ARCHITECTURE.md §2.1–2.3（页面 8）/ §9.5（SSE 协议）、DATABASE.md §4.8–4.9（chat_sessions/chat_messages）、`docs/superpowers/plans/2026-08-16-later-development-execution-plan.md` P2 Task 2.5。
> **执行原则**: brainstorm → writing-plans → 实现时用 frontend-design skill。

---

## 1. 目标与范围

把 `apps/web` 的 chat 模块从「REST 骨架」补到 ARCHITECTURE.md §9.5 的完整 SSE 契约体验，并做视觉/交互打磨。后端 chat 模块（plan P2）尚未实现，前端按**已文档化契约**实现，传输层可 mock，P2 后端就绪即插即用。

### 当前差距（code map 核对 2026-08-17）

| 差距 | 现状 |
|---|---|
| 无流式 | `chat.api.ts` 仅 REST：单 POST 返回全量 → 重新 GET 全列表。无 `EventSource`/`ReadableStream`/`text/event-stream` |
| 引用未渲染 | `types/chat.ts` 有 `Citation`，但 `ChatMessage.vue` 不渲染 |
| 无反馈/无 token 计量 UI | 缺 like/dislike、token/latency 展示 |
| `/chat/new` 坏链 | 导航到字面 `"new"` 作 sessionId；`createSession` 已定义但无 composable 调用 |
| 进场动画 bug | `ChatMessage.vue` 模板类 `message-enter` ≠ scoped CSS 的 `message-enter-active/-from` |
| 设计系统未充分利用 | 主题系统（Tailwind v4 CSS-first + Element Plus，uber/coinbase/rabbit + dark，完整 token）成熟，chat 用得单薄 |

### 关键决策

1. **范围 = 全面对齐契约**（用户选定）：视觉 + SSE 五事件流式 + 引用 + 反馈 + token，修 `/chat/new` 与动画 bug。
2. **引用 = 消息内折叠卡片**（用户选定）：保留两栏（会话列表 | 消息流），引用作为助手消息下方折叠 `📎 N 条来源 ▾` 卡片。
3. **架构 = 方案一**（用户选定）：composable 封装 SSE 状态机 + 可 mock 传输层；历史走 TanStack Query，实时流走独立 `useChatStream`。
4. **SSE 线格式 = 执行计划的 `{type, data}` 单事件**（比 ARCHITECTURE §9.5 的具名 `event:` 行更新、更近实现，以执行计划为准）。解析层支持该格式。
5. **Markdown 渲染**: 助手消息用 `markdown-it` + `DOMPurify` 渲染（RAG 回答常含列表/代码/表格），唯一新增运行时依赖；纯文本用于 user 消息。

### 不在范围（YAGNI）

- 后端 chat 模块实现（属 P2，独立工作）。
- 多模态上传、语音输入、消息编辑、分支对话、消息搜索。
- 引用点击跳转到原文高亮（v1 仅展示）。
- 移动端仅做轻量收纳（会话列表抽屉），非优先。
- `step` 事件只展示阶段横幅，不做逐节点执行追踪 UI（属 workflow executions）。

---

## 2. 架构与组件拆解

### 2.1 文件结构（沿用模块规范 `modules/<feature>/{api,components,composables,types,views}`）

```
apps/web/src/modules/chat/
├── api/
│   └── chat.api.ts              # +sendMessageStream(原生 fetch SSE), +sendFeedback
├── transport/                   # 新增
│   ├── chat-transport.ts        #   ChatTransport 接口 + ChatStreamEvent/MessagePhase 类型
│   ├── fetch-sse.transport.ts   #   真实: fetch + ReadableStream → 解析 {type,data}
│   └── mock-sse.transport.ts    #   开发: 定时器合成 step/citations/delta*/done
├── types/
│   └── chat.ts                  # +ChatStreamEvent, MessagePhase, TokenUsage, feedback 字段
├── composables/
│   └── useChat.ts               # +useChatStream 状态机; 修 send/new 流程
├── components/
│   ├── ChatMessage.vue          # 重写: markdown + 流式光标 + CitationsCard + 反馈 + tokens
│   ├── CitationsCard.vue        # 新增: 折叠 📎N条来源 → 展开行
│   ├── ChatStreamStatus.vue     # 新增: 阶段横幅(检索/精排/生成) 驱动自 step
│   ├── ChatInput.vue            # 升级: textarea + Enter发送/Shift+Enter换行 + Stop
│   ├── ChatSessionList.vue      # 更丰富条目: 预览/时间/workflow标签/删除
│   └── ChatEmptyState.vue       # 新增: 欢迎语 + 建议问题
└── views/
    ├── ChatList.vue             # 落地: 会话列表 + 空状态
    └── ChatSession.vue          # 编排: list + thread + input; 自动滚动; 路由 `new`
```

### 2.2 单元职责

- **`chat-transport.ts`** — `ChatTransport` 接口 `stream(req, signal): AsyncGenerator<ChatStreamEvent>`；`ChatStreamEvent = { type:'step'|'citations'|'delta'|'done'|'error'; data: any }`；`MessagePhase`。零 UI、零 axios。
- **`fetch-sse.transport.ts`** — 取 baseURL（`api/client.ts`）+ token（auth store），`fetch POST` 取 `ReadableStream`，按 `\n\n` 分块、合 `data:` 行、`[DONE]` 终止、`JSON.parse` → `{type,data}` yield；`signal.aborted` 关 reader 返回。axios 拦截器不覆盖此路径（fetch 直连，手动注入 Bearer）。
- **`mock-sse.transport.ts`** — 定时器：`step{retrieval}` ~400ms → `citations`(2 假引用) → `step{generating}` → `delta*`(~8 片 ~120ms) → `done{usage, citations}`。响应 abort。
- **`useChatStream()`** — 状态机 owner。`send(sessionId, content)`：乐观 append user msg + 流式 assistant 占位 → 开 transport.stream → 路由事件（见 §3）。`stop()` abort。`sendFeedback(messageId, action)`。处理 `/chat/new`：首条发送先 `createSession` 得真 id → 替换路由 → 再 stream。
- **`ChatMessage.vue`** — 纯展示。props `message`（含 `streaming`、`phase`、`citations`、`feedback`、`usage`）。markdown 渲染、角色气泡差异、流式光标、`<CitationsCard>`、反馈行、token/latency 页脚、复制。
- **`CitationsCard.vue`** — 折叠 `📎 {n} 条来源 ▾` → 展开编号行 `① {documentName} · p{page} · {score}` + snippet。
- **`ChatStreamStatus.vue`** — 横幅 spinner + step 消息；done 后淡出。
- **`ChatInput.vue`** — autosize textarea；Enter 发送/Shift+Enter 换行；流式时禁用输入且按钮变 Stop(abort)；字符提示；焦点管理。
- **`ChatSessionList.vue`** — 条目：标题/预览/相对时间/workflow 标签/active 高亮/删除；骨架；空状态。
- **`ChatEmptyState.vue`** — 居中欢迎 + 3 建议问题芯片。
- **`ChatSession.vue`** — 编排：`grid-cols-[260px_1fr]`；左 `ChatSessionList`；右 header(title+workflow 标签+删除) + 滚动 thread + `ChatStreamStatus` + 底部 `ChatInput`；自动贴底 + 回底浮动按钮；路由 `new` 处理。

### 2.3 数据流

```
历史: GET /chat/sessions/:id/messages → useChatMessages (Query 缓存) → 渲染列表
实时: useChatStream.send()
  ├─ 乐观 append user msg + 流式 assistant 占位(tempId)
  ├─ ChatTransport.stream() —— fetch-sse(真实) 或 mock-sse(开发)
  │     step       → ChatStreamStatus.phase
  │     citations → streamingMessage.citations
  │     delta*     → streamingMessage.content += (打字机)
  │     done       → 定稿 usage/citations; 失效 Query ['chat-messages', id]
  │                   → 历史调和(按 done.data.messageId 去重，真消息替换临时副本)
  │     error      → 错误态(可重试)
  └─ stop() → abortController.abort()
```

---

## 3. 流式状态机 + SSE 解析 + mock

### 3.1 单条助手消息状态机

```
idle ─ send() ─▶ pendingCreate   (sessionId==='new': createSession→真id, 替换路由)
                   │ resolved
                   ▼
               retrieving         ← step{retrieval|reranking} 设 phase
                   │
                   ▼
               generating         ← step{generating} 设 phase；若未收到该 step，首个 delta 亦置 generating
                   │ delta* 累加
                   ▼
               done               ← done{usage, citations?} 定稿
                   │
                   ▼
          (历史经 Query 失效调和; 临时副本被真消息替换)

任一态 ─ error 事件 ─▶ error (展示重试)
任一态 ─ stop()     ─▶ aborted (保留已生成部分，标记已停止)
```

### 3.2 SSE 解析（`fetch-sse.transport.ts`）

- `fetch(baseURL + '/chat/sessions/' + id + '/messages', { method:'POST', headers:{ Authorization:'Bearer '+token, 'Content-Type':'application/json' }, body: JSON.stringify({ content }), signal })`
- `response.body.getReader()` + `TextDecoder`；缓冲区按 `\n\n` 切块；每块合 `data:` 行 → 若为 `[DONE]` 结束，否则 `JSON.parse` → `{type, data}` yield。
- 中断：`signal.aborted` → `reader.cancel()`，generator return；fetch reject → 合成一个 `error` 事件 yield（统一错误路径）。

### 3.3 mock（`mock-sse.transport.ts`）

- `stream(req, signal)`：立即 `step{retrieval,"正在检索知识库…"}` → ~400ms → `citations`(2 条假引用) → `step{generating,"正在生成回答…"}` → 将固定答案切片 ~8 段每 ~120ms yield `delta` → `done{ {promptTokens:420,completionTokens:120,totalTokens:540}, citations }`。全程检查 `signal.aborted`，中断即停。
- 引用/答案从 fixtures 读取，便于改。

### 3.4 边界与调和

- **并发发送**: 流式中禁用输入/按钮显 Stop；同一 session 同时只允许一条流式。
- **done 无前置 citations**: citations 降级为空数组。
- **中途网络错误**: fetch reject 或 error 事件 → error 态 + 重试按钮（重试只重发该 user 消息，不重放流式片段）。
- **临时/真消息去重**: 流式占位带 `tempId`；`done.data.messageId` 为真 id。done 后将占位 `streaming=false` 并记真 id；失效 Query；refetch 历史到达后 thread 按 `messageId` 去重——真消息替换占位（占位在 refetch 期间保留显示，避免闪烁）。

---

## 4. 视觉/交互规范（每组件）

设计方向: 尊重现有设计系统（token 驱动：`--accent`/`--surface`/`--surface-secondary`/`--foreground`/`--border`/`--accent-soft`/`--accent-glow`），跨 uber/coinbase/rabbit + dark 全工作。企业 console 打磨，不另立美学。

### 4.1 ChatMessage

- **User**: 右对齐，`bg-accent/10` bubble，`rounded-2xl`，`max-w-[80%]`。
- **Assistant**: 左对齐，头像小圆（`--accent` 底，图标），`bg-surface` 卡 + `border`，`max-w-[80%]`，`rounded-2xl`。
- **Markdown**: prose 排版（标题/列表/代码块 `font-mono` + `bg-surface-secondary`/表格/链接新标签）；DOMPurify 清洗防 XSS。User 消息纯文本。
- **流式**: 末尾闪烁光标 `▋`（`--accent`）；`phase!==done` 时上方显 `<ChatStreamStatus>`。
- **引用**: 助手消息下方 `<CitationsCard>`（仅 `citations.length>0`）。
- **页脚行**(assistant, done 后): `👍/👎`(选中态高亮) · 复制图标 · `prompt/completion/total` 小 mono 文本 · `latency`。
- **进场**: 修 `<Transition name="msg">`，scoped CSS 用 `msg-enter-active/-from/-to`（与模板类一致）。

### 4.2 CitationsCard

- 折叠 chip `📎 {n} 条来源 ▾`：`bg-surface-secondary`、`text-foreground/70`、`border`、`rounded-lg`、hover `bg-accent/10`。
- 展开行：`① {documentName} · p{page} · {score.toFixed(2)}` + snippet（2 行截断）。
- 点击 chip 切换；展开时图标 `▾`→`▴`。

### 4.3 ChatStreamStatus

- 横幅 `bg-accent/5`、`text-accent`、spinner + step 消息；done 淡出（`--dur-base`）。
- 文案映射: retrieval→"正在检索知识库…"、reranking→"正在精排结果…"、generating→"正在生成回答…"。

### 4.4 ChatInput

- `el-input type=textarea` autosize（min 1 行，max 6 行）。
- placeholder "输入问题，Enter 发送，Shift+Enter 换行"。
- 右侧: 空闲→`发送`(Promotion, primary)；流式→`停止`(VideoPause, danger/subtle)→`stop()`；空内容禁用发送。
- 字符提示 `{n}`。

### 4.5 ChatSessionList

- 条目: 标题(truncate) + 最后消息预览(1 行 muted) + 相对时间(dayjs fromNow) + workflow 标签(`el-tag` size small) + active=`bg-accent/10`+左 accent 条 + hover 显删除(`el-popconfirm`)。
- 顶 `+ 新会话`；加载 5× 骨架；空 `el-empty`。

### 4.6 ChatEmptyState

- 居中: 会话/应用标题 + 简短提示 + 3 建议问题芯片(点击→填入输入框)。

### 4.7 ChatSession(view)

- `grid-cols-[260px_1fr]`；左 `ChatSessionList`；右: header(title+workflow 标签+删除) + `overflow-y-auto` thread + `ChatStreamStatus` + 底部 `ChatInput`。
- 自动贴底(新消息/增量时滚到底)；`scrollTop < max-threshold` 时显「回到底部」浮动按钮。
- 响应式: `<md` 会话列表折叠为抽屉(轻量，非优先)。

---

## 5. 类型定义（`types/chat.ts` 扩展）

```ts
export type MessagePhase = 'idle' | 'pendingCreate' | 'retrieving' | 'reranking' | 'generating' | 'done' | 'error' | 'aborted';

export interface ChatStreamEvent {
  type: 'step' | 'citations' | 'delta' | 'done' | 'error';
  data:
    | { step: 'retrieval' | 'reranking' | 'generating'; message?: string }
    | Citation[]
    | { content: string }
    | { messageId: string; usage?: TokenUsage; citations?: Citation[] }
    | { code?: string; message: string };
}

export interface TokenUsage { promptTokens: number; completionTokens: number; totalTokens: number; }

export interface Citation { chunkId?: string; documentName: string; page?: number; snippet?: string; score?: number; }

export interface ChatMessage {
  id?: string;            // 真实 id（done 后）；流式占位用 tempId
  tempId?: string;
  sessionId: string;
  role: 'user' | 'assistant';
  content: string;
  citations?: Citation[];
  metadata?: { latencyMs?: number; model?: string; executionId?: string; truncated?: boolean };
  promptTokens?: number; completionTokens?: number; totalTokens?: number;
  feedback?: 'like' | 'dislike' | null;
  // 客户端瞬时
  streaming?: boolean;
  phase?: MessagePhase;
  error?: string;
  createdAt?: string;
}

export interface ChatSession {
  id: string; title: string; workflowType?: string; kbId?: string; aiApplicationId?: string;
  lastMessage?: { content: string; role: string; createdAt: string };
  createdAt: string;
}
```

---

## 6. 测试与 dev-mock 计划

### 6.1 单测

- **`fetch-sse.transport.ts`**: 喂 fixture SSE 字节流，断言按序 yield 类型化事件、`[DONE]` 终止、abort 关 reader。
- **`mock-sse.transport.ts`**: 断言事件序列（step→citations→step→delta*→done）+ abort 响应。
- **`useChatStream`**: mock transport，断言 phase 迁移、delta 累加、done 定稿 + Query 失效调用、error/retry、stop() abort、`/chat/new` 先 createSession 再 stream。

### 6.2 组件测试

- `ChatMessage`: markdown 渲染 + 流式光标 + CitationsCard 切换 + 反馈回调。
- `ChatInput`: Enter/Shift+Enter 行为 + Stop。
- `ChatSessionList`: 条目/骨架/空。

### 6.3 手动/E2E（后端缺失，mock 驱动）

`VITE_CHAT_MOCK=1`（或运行时 dev 开关）→ `useChatStream` 用 `mockSSETransport`。场景: 新会话→发送→阶段横幅→打字→引用卡→done→token；流式中 Stop；反馈；切 uber/coinbase/rabbit + dark。

### 6.4 dev-mock 接线

`useChatStream` 注入 `ChatTransport`：`import.meta.env.VITE_CHAT_MOCK ? mockSSETransport : fetchSSETransport`。mock 引用/答案读 fixture 文件。

---

## 7. 假设与待确认

- SSE 线格式以执行计划 `{type,data}` 单事件为准（ARCHITECTURE §9.5 具名 `event:` 视为旧版）。后端 P2 实现需对齐此格式。
- 后端 `POST /chat/sessions/:id/messages` 返回 `text/event-stream`（非 axios JSON）。
- 反馈端点 `POST /chat/messages/:id/feedback` body `{ action:'like'|'dislike', comment? }` → 写 `chat_messages.metadata`（对齐 plan Task 2.4）。
- `/chat/new` 修复策略: 首条消息触发 `createSession` 得真 id → `router.replace('/chat/'+id)` → 再 stream。
- 新增依赖 `markdown-it` + `dompurify`（+ `@types/markdown-it` dev）。
