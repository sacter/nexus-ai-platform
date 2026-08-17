# Chat 前端优化（对齐 SSE 契约）实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把 `apps/web` 的 chat 模块从 REST 骨架补到 ARCHITECTURE §9.5 的 SSE 流式契约（五事件 + 引用 + 反馈 + token），并做视觉/交互打磨；后端未上线，传输层可 mock。

**Architecture:** 方案一 —— composable 封装 SSE 状态机 + 可 mock 传输层。新增 `transport/`（`ChatTransport` 接口 + fetch-sse + mock-sse 实现）与纯函数 reducer（`chat-stream-reducer.ts`，TDD 可测）；`useChatStream` 作为响应式外壳复用 reducer；历史走 TanStack Query，实时流走独立 composable。组件保持纯展示，复用现有 Tailwind v4 + Element Plus + 主题 token。

**Tech Stack:** Vue 3.5 `<script setup lang="ts">`、Vite 6、TanStack Vue Query 5、Element Plus 2.10、Tailwind v4（CSS-first token）、vue-router 4、dayjs；新增 `markdown-it` + `dompurify`；测试 `vitest` + `@vue/test-utils` + `happy-dom`。

**Spec:** `docs/superpowers/specs/2026-08-17-chat-frontend-design.md`（分支 `feat/chat-frontend-design`，已提交）。

**横切：**
- 包名 `@nexus/web-v2`；用 `pnpm --filter @nexus/web-v2 <cmd>` 跑命令，避免 `cd`。
- 现有 `api/client.ts` 的 axios 拦截器**不覆盖** SSE 路径（fetch 直连，手动注入 Bearer）。
- 主题 token：`--accent` `--surface` `--surface-secondary` `--foreground` `--border` `--accent-soft` `--accent-glow`；Tailwind 工具类 `bg-accent` `text-foreground` `bg-accent/10` 等可用。

---

## 文件结构总览

```
apps/web/
├── vitest.config.ts                     # 新增 — 测试配置
├── package.json                        # 改 — +test 脚本 + 依赖
├── src/modules/chat/
│   ├── api/chat.api.ts                 # 改 — +sendFeedback, +deleteSession
│   ├── transport/                       # 新增
│   │   ├── chat-transport.ts            #   ChatTransport 接口 + 类型
│   │   ├── fetch-sse.transport.ts       #   真实 SSE 解析
│   │   └── mock-sse.transport.ts        #   开发 mock
│   ├── composables/
│   │   ├── chat-stream-reducer.ts       # 新增 — 纯函数 reducer（TDD）
│   │   └── useChat.ts                   # 改 — +useChatStream
│   ├── types/chat.ts                    # 改 — +SSE 事件/phase/token/feedback
│   ├── utils/
│   │   └── render-markdown.ts           # 新增 — markdown-it + DOMPurify
│   ├── components/
│   │   ├── ChatMessage.vue              # 重写
│   │   ├── CitationsCard.vue            # 新增
│   │   ├── ChatStreamStatus.vue         # 新增
│   │   ├── ChatInput.vue                # 改
│   │   ├── ChatSessionList.vue          # 改
│   │   └── ChatEmptyState.vue           # 新增
│   └── views/
│       ├── ChatList.vue                 # 改
│       └── ChatSession.vue              # 改
```

每个任务产出一个可提交、可测的增量。

---

## Task 1: 引入测试基础设施

**Files:**
- Create: `apps/web/vitest.config.ts`
- Modify: `apps/web/package.json`

- [ ] **Step 1: 安装测试依赖**

Run: `pnpm --filter @nexus/web-v2 add -D vitest @vue/test-utils happy-dom`
Expected: 依赖写入 `package.json` devDependencies。

- [ ] **Step 2: 写 vitest 配置**

`apps/web/vitest.config.ts`:

```ts
import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'
import { resolve } from 'path'

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: { '@': resolve(__dirname, 'src') },
  },
  test: {
    environment: 'happy-dom',
    globals: true,
  },
})
```

- [ ] **Step 3: 加 test 脚本**

修改 `apps/web/package.json` 的 `scripts`，加入：

```json
    "test": "vitest",
    "test:run": "vitest run"
```

- [ ] **Step 4: 写冒烟测试验证基础设施**

Create: `apps/web/src/modules/chat/__tests__/smoke.spec.ts`:

```ts
import { describe, it, expect } from 'vitest'

describe('smoke', () => {
  it('runs vitest', () => {
    expect(1 + 1).toBe(2)
  })
})
```

- [ ] **Step 5: 跑测试验证通过**

Run: `pnpm --filter @nexus/web-v2 test:run src/modules/chat/__tests__/smoke.spec.ts`
Expected: 1 passed。

- [ ] **Step 6: Commit**

```bash
git add apps/web/vitest.config.ts apps/web/package.json apps/web/src/modules/chat/__tests__/smoke.spec.ts
git commit -m "test(web): 引入 vitest 测试基础设施"
```

---

## Task 2: 安装 markdown 依赖

**Files:**
- Modify: `apps/web/package.json`

- [ ] **Step 1: 安装运行时依赖**

Run: `pnpm --filter @nexus/web-v2 add markdown-it dompurify && pnpm --filter @nexus/web-v2 add -D @types/markdown-it`
Expected: `markdown-it`、`dompurify` 入 dependencies，`@types/markdown-it` 入 devDependencies。

- [ ] **Step 2: 验证类型可解析**

Run: `pnpm --filter @nexus/web-v2 check-types`
Expected: 无新增类型错误（既有错误数不增）。

- [ ] **Step 3: Commit**

```bash
git add apps/web/package.json apps/web/pnpm-lock.yaml
git commit -m "feat(web): 引入 markdown-it + dompurify"
```

---

## Task 3: 扩展 chat 类型定义

**Files:**
- Modify: `apps/web/src/modules/chat/types/chat.ts`

- [ ] **Step 1: 写完整新类型文件**

替换 `apps/web/src/modules/chat/types/chat.ts` 全文为：

```ts
export type MessagePhase =
  | 'idle' | 'pendingCreate' | 'retrieving' | 'reranking'
  | 'generating' | 'done' | 'error' | 'aborted'

export interface TokenUsage {
  promptTokens: number
  completionTokens: number
  totalTokens: number
}

export interface Citation {
  chunkId?: string
  documentName: string
  page?: number
  snippet?: string
  score?: number
}

export interface ChatStreamEvent {
  type: 'step' | 'citations' | 'delta' | 'done' | 'error'
  data:
    | { step: 'retrieval' | 'reranking' | 'generating'; message?: string }
    | Citation[]
    | { content: string }
    | { messageId: string; usage?: TokenUsage; citations?: Citation[] }
    | { code?: string; message: string }
}

export interface ChatMessage {
  id?: string
  tempId?: string
  sessionId: string
  role: 'user' | 'assistant' | 'system'
  content: string
  citations?: Citation[]
  metadata?: { latencyMs?: number; model?: string; executionId?: string; truncated?: boolean }
  promptTokens?: number
  completionTokens?: number
  totalTokens?: number
  feedback?: 'like' | 'dislike' | null
  streaming?: boolean
  phase?: MessagePhase
  error?: string
  createdAt?: string
}

export interface ChatSession {
  id: string
  title: string
  workflowType?: string
  kbId?: string
  aiApplicationId?: string
  lastMessage?: { content: string; role: string; createdAt: string }
  createdAt: string
}
```

- [ ] **Step 2: 验证类型**

Run: `pnpm --filter @nexus/web-v2 check-types`
Expected: 无错误（纯类型新增）。

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/modules/chat/types/chat.ts
git commit -m "feat(chat): 扩展类型 — SSE 事件/phase/token/feedback"
```

---

## Task 4: 传输层接口

**Files:**
- Create: `apps/web/src/modules/chat/transport/chat-transport.ts`

- [ ] **Step 1: 写接口文件**

```ts
import type { ChatStreamEvent } from '../types/chat'

export interface ChatStreamRequest {
  sessionId: string
  content: string
  signal?: AbortSignal
}

export interface ChatTransport {
  stream(req: ChatStreamRequest): AsyncGenerator<ChatStreamEvent, void, unknown>
}
```

- [ ] **Step 2: 验证类型**

Run: `pnpm --filter @nexus/web-v2 check-types`
Expected: 无错误。

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/modules/chat/transport/chat-transport.ts
git commit -m "feat(chat): ChatTransport 传输层接口"
```

---

## Task 5: 纯函数 reducer（TDD）

**Files:**
- Create: `apps/web/src/modules/chat/composables/chat-stream-reducer.ts`
- Test: `apps/web/src/modules/chat/__tests__/chat-stream-reducer.spec.ts`

- [ ] **Step 1: 写失败测试**

Create `apps/web/src/modules/chat/__tests__/chat-stream-reducer.spec.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { applyStreamEvent, type ReduceState } from '../composables/chat-stream-reducer'
import type { ChatMessage } from '../types/chat'

function base(): ReduceState {
  const message: ChatMessage = {
    tempId: 't1', sessionId: 's1', role: 'assistant',
    content: '', streaming: true, phase: 'retrieving', citations: [],
  }
  return { message, phase: 'retrieving' }
}

describe('applyStreamEvent', () => {
  it('step event transitions phase', () => {
    const s = applyStreamEvent(base(), { type: 'step', data: { step: 'generating' } })
    expect(s.phase).toBe('generating')
    expect(s.message.phase).toBe('generating')
  })

  it('citations event attaches citations', () => {
    const s = applyStreamEvent(base(), { type: 'citations', data: [{ documentName: 'a.pdf', page: 1, score: 0.9 }] })
    expect(s.message.citations).toHaveLength(1)
    expect(s.message.citations![0].documentName).toBe('a.pdf')
  })

  it('delta event appends content and sets generating', () => {
    let s = applyStreamEvent(base(), { type: 'delta', data: { content: 'Hello' } })
    s = applyStreamEvent(s, { type: 'delta', data: { content: ' world' } })
    expect(s.message.content).toBe('Hello world')
    expect(s.phase).toBe('generating')
  })

  it('done event finalizes with id and usage', () => {
    const s = applyStreamEvent(base(), {
      type: 'done',
      data: { messageId: 'm1', usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 } },
    })
    expect(s.phase).toBe('done')
    expect(s.message.streaming).toBe(false)
    expect(s.message.id).toBe('m1')
    expect(s.message.totalTokens).toBe(15)
  })

  it('error event sets error state', () => {
    const s = applyStreamEvent(base(), { type: 'error', data: { message: 'boom' } })
    expect(s.phase).toBe('error')
    expect(s.message.streaming).toBe(false)
    expect(s.message.error).toBe('boom')
  })
})
```

- [ ] **Step 2: 跑测试确认失败**

Run: `pnpm --filter @nexus/web-v2 test:run src/modules/chat/__tests__/chat-stream-reducer.spec.ts`
Expected: FAIL — `applyStreamEvent` 未定义（模块不存在）。

- [ ] **Step 3: 写实现**

Create `apps/web/src/modules/chat/composables/chat-stream-reducer.ts`:

```ts
import type { ChatMessage, ChatStreamEvent, Citation, MessagePhase } from '../types/chat'

export interface ReduceState {
  message: ChatMessage
  phase: MessagePhase
}

export function applyStreamEvent(prev: ReduceState, ev: ChatStreamEvent): ReduceState {
  const message: ChatMessage = { ...prev.message }
  let phase = prev.phase

  switch (ev.type) {
    case 'step': {
      const step = (ev.data as { step?: string }).step
      if (step === 'retrieval') phase = 'retrieving'
      else if (step === 'reranking') phase = 'reranking'
      else if (step === 'generating') phase = 'generating'
      message.phase = phase
      break
    }
    case 'citations':
      message.citations = ev.data as Citation[]
      break
    case 'delta': {
      phase = 'generating'
      message.phase = 'generating'
      const delta = (ev.data as { content?: string }).content ?? ''
      message.content = (message.content ?? '') + delta
      break
    }
    case 'done': {
      const d = ev.data as {
        messageId?: string
        usage?: { promptTokens?: number; completionTokens?: number; totalTokens?: number }
        citations?: Citation[]
      }
      phase = 'done'
      message.streaming = false
      message.phase = 'done'
      if (d.messageId) message.id = d.messageId
      if (d.citations) message.citations = d.citations
      if (d.usage) {
        message.promptTokens = d.usage.promptTokens
        message.completionTokens = d.usage.completionTokens
        message.totalTokens = d.usage.totalTokens
      }
      break
    }
    case 'error': {
      const e = ev.data as { message?: string }
      phase = 'error'
      message.streaming = false
      message.phase = 'error'
      message.error = e.message ?? '生成失败'
      break
    }
  }

  return { message, phase }
}
```

- [ ] **Step 4: 跑测试确认通过**

Run: `pnpm --filter @nexus/web-v2 test:run src/modules/chat/__tests__/chat-stream-reducer.spec.ts`
Expected: 5 passed。

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/modules/chat/composables/chat-stream-reducer.ts apps/web/src/modules/chat/__tests__/chat-stream-reducer.spec.ts
git commit -m "feat(chat): 流式事件纯函数 reducer + 单测"
```

---

## Task 6: fetch SSE 传输实现（TDD）

**Files:**
- Create: `apps/web/src/modules/chat/transport/fetch-sse.transport.ts`
- Test: `apps/web/src/modules/chat/__tests__/fetch-sse.transport.spec.ts`

- [ ] **Step 1: 写失败测试**

Create `apps/web/src/modules/chat/__tests__/fetch-sse.transport.spec.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { FetchSseChatTransport } from '../transport/fetch-sse.transport'

// 构造一个 fake ReadableStream，吐出 SSE 字节
function sseBody(chunks: string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder()
  return new ReadableStream({
    start(controller) {
      for (const c of chunks) controller.enqueue(encoder.encode(c))
      controller.close()
    },
  })
}

describe('FetchSseChatTransport', () => {
  it('parses {type,data} events and yields them in order', async () => {
    const payload = [
      'data: {"type":"step","data":{"step":"retrieval","message":"检索中"}}\n\n',
      'data: {"type":"delta","data":{"content":"Hello"}}\n\n',
      'data: {"type":"delta","data":{"content":" world"}}\n\n',
      'data: {"type":"done","data":{"messageId":"m1","usage":{"promptTokens":1,"completionTokens":2,"totalTokens":3}}}\n\n',
      'data: [DONE]\n\n',
    ].join('')
    const fakeFetch = (() => Promise.resolve({
      ok: true,
      body: sseBody([payload]),
    } as unknown as Response)) as unknown as typeof fetch

    const transport = new FetchSseChatTransport(
      { baseUrl: 'http://x', getToken: () => 'tok' },
      fakeFetch,
    )
    const events = []
    for await (const ev of transport.stream({ sessionId: 's1', content: 'hi' })) events.push(ev)
    expect(events.map(e => e.type)).toEqual(['step', 'delta', 'delta', 'done'])
    expect(events[1].data).toEqual({ content: 'Hello' })
    expect((events[3].data as any).messageId).toBe('m1')
  })

  it('yields an error event on non-ok response', async () => {
    const fakeFetch = (() => Promise.resolve({ ok: false, status: 500, body: null } as unknown as Response)) as unknown as typeof fetch
    const transport = new FetchSseChatTransport({ baseUrl: 'http://x', getToken: () => null }, fakeFetch)
    const events = []
    for await (const ev of transport.stream({ sessionId: 's1', content: 'hi' })) events.push(ev)
    expect(events).toHaveLength(1)
    expect(events[0].type).toBe('error')
  })
})
```

- [ ] **Step 2: 跑测试确认失败**

Run: `pnpm --filter @nexus/web-v2 test:run src/modules/chat/__tests__/fetch-sse.transport.spec.ts`
Expected: FAIL — 模块不存在。

- [ ] **Step 3: 写实现**

Create `apps/web/src/modules/chat/transport/fetch-sse.transport.ts`:

```ts
import type { ChatStreamEvent } from '../types/chat'
import type { ChatStreamRequest, ChatTransport } from './chat-transport'

export interface FetchSseOptions {
  baseUrl: string
  getToken: () => string | null
}

export class FetchSseChatTransport implements ChatTransport {
  constructor(
    private readonly opts: FetchSseOptions,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  async *stream(req: ChatStreamRequest): AsyncGenerator<ChatStreamEvent, void, unknown> {
    const token = this.opts.getToken()
    const res: Response = await this.fetchImpl(
      `${this.opts.baseUrl}/chat/sessions/${req.sessionId}/messages`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ content: req.content }),
        signal: req.signal,
      },
    )

    if (!res.ok || !res.body) {
      yield { type: 'error', data: { message: `HTTP ${res.status}` } }
      return
    }

    const reader = res.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''
    try {
      while (true) {
        const { value, done } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true }).replace(/\r\n/g, '\n')
        let idx: number
        while ((idx = buffer.indexOf('\n\n')) >= 0) {
          const chunk = buffer.slice(0, idx)
          buffer = buffer.slice(idx + 2)
          const dataStr = chunk
            .split('\n')
            .filter((l) => l.startsWith('data:'))
            .map((l) => l.slice(5).trim())
            .join('\n')
          if (!dataStr) continue
          if (dataStr === '[DONE]') return
          try {
            yield JSON.parse(dataStr) as ChatStreamEvent
          } catch {
            // 跳过格式异常的事件
          }
        }
      }
    } finally {
      reader.releaseLock()
    }
  }
}
```

- [ ] **Step 4: 跑测试确认通过**

Run: `pnpm --filter @nexus/web-v2 test:run src/modules/chat/__tests__/fetch-sse.transport.spec.ts`
Expected: 2 passed。

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/modules/chat/transport/fetch-sse.transport.ts apps/web/src/modules/chat/__tests__/fetch-sse.transport.spec.ts
git commit -m "feat(chat): fetch SSE 传输实现 + 解析单测"
```

---

## Task 7: mock SSE 传输（TDD）

**Files:**
- Create: `apps/web/src/modules/chat/transport/mock-sse.transport.ts`
- Test: `apps/web/src/modules/chat/__tests__/mock-sse.transport.spec.ts`

- [ ] **Step 1: 写失败测试**

Create `apps/web/src/modules/chat/__tests__/mock-sse.transport.spec.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { MockSseChatTransport } from '../transport/mock-sse.transport'

describe('MockSseChatTransport', () => {
  // 用真实定时器 + 极小延迟（stepDelay/deltaDelay）；fake timers 下 for-await 会阻塞在 sleep 上导致超时
  it('emits step → citations → step → delta* → done sequence', async () => {
    const transport = new MockSseChatTransport({ stepDelay: 1, deltaDelay: 1 })
    const events = []
    for await (const ev of transport.stream({ sessionId: 's1', content: 'hi' })) events.push(ev)
    const types = events.map(e => e.type)
    expect(types[0]).toBe('step')
    expect(types[1]).toBe('citations')
    expect(types[2]).toBe('step')
    expect(types.filter(t => t === 'delta').length).toBeGreaterThan(0)
    expect(types[types.length - 1]).toBe('done')
    const done = events.find(e => e.type === 'done')
    expect((done.data as any).usage.totalTokens).toBeGreaterThan(0)
    expect((done.data as any).messageId).toBeTruthy()
  })

  it('stops emitting after abort', async () => {
    const ctrl = new AbortController()
    const transport = new MockSseChatTransport({ stepDelay: 1, deltaDelay: 1 })
    const types: string[] = []
    for await (const ev of transport.stream({ sessionId: 's1', content: 'hi', signal: ctrl.signal })) {
      types.push(ev.type)
      if (types.length === 2) ctrl.abort()
    }
    expect(types.length).toBeLessThanOrEqual(5)
    expect(types[types.length - 1]).not.toBe('done')
  })
})
```

> 注：用真实定时器 + 极小 `stepDelay`/`deltaDelay` 驱动 mock；fake timers 下 `for await` 会阻塞在内部 `sleep` 上直到测试超时。`done.data.messageId` 由 `crypto.randomUUID()` 生成（Node 全局 `crypto` 提供）。

- [ ] **Step 2: 跑测试确认失败**

Run: `pnpm --filter @nexus/web-v2 test:run src/modules/chat/__tests__/mock-sse.transport.spec.ts`
Expected: FAIL — 模块不存在。

- [ ] **Step 3: 写实现**

Create `apps/web/src/modules/chat/transport/mock-sse.transport.ts`:

```ts
import type { ChatStreamEvent } from '../types/chat'
import type { ChatStreamRequest, ChatTransport } from './chat-transport'

const ANSWER =
  '根据员工手册，请假需提前提交申请，流程如下：\n\n1. 提前 3 个工作日提交请假申请\n2. 直属主管审批\n3. HR 备案'

const CITATIONS = [
  { documentName: '员工手册.pdf', page: 12, snippet: '员工请假需提前 3 个工作日提交申请…', score: 0.92 },
  { documentName: '考勤制度.pdf', page: 3, snippet: '请假申请步骤：提交→审批→备案…', score: 0.85 },
]

const sleep = (ms: number, signal?: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    if (signal?.aborted) return reject(new DOMException('Aborted', 'AbortError'))
    const t = setTimeout(resolve, ms)
    signal?.addEventListener('abort', () => { clearTimeout(t); reject(new DOMException('Aborted', 'AbortError')) })
  })

export class MockSseChatTransport implements ChatTransport {
  constructor(private readonly opts: { stepDelay?: number; deltaDelay?: number } = {}) {}

  async *stream(req: ChatStreamRequest): AsyncGenerator<ChatStreamEvent, void, unknown> {
    const signal = req.signal
    const aborted = () => signal?.aborted === true
    const stepDelay = this.opts.stepDelay ?? 400
    const deltaDelay = this.opts.deltaDelay ?? 120
    try {
      yield { type: 'step', data: { step: 'retrieval', message: '正在检索知识库…' } }
      await sleep(stepDelay, signal)
      if (aborted()) return
      yield { type: 'citations', data: CITATIONS }
      yield { type: 'step', data: { step: 'generating', message: '正在生成回答…' } }
      const parts = ANSWER.match(/[\s\S]{1,18}/g) ?? [ANSWER]
      for (const p of parts) {
        if (aborted()) return
        await sleep(deltaDelay, signal)
        yield { type: 'delta', data: { content: p } }
      }
      if (aborted()) return
      yield {
        type: 'done',
        data: {
          messageId: crypto.randomUUID(),
          usage: { promptTokens: 420, completionTokens: 120, totalTokens: 540 },
          citations: CITATIONS,
        },
      }
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') return
      yield { type: 'error', data: { message: 'mock 错误' } }
    }
  }
}
```

- [ ] **Step 4: 跑测试确认通过**

Run: `pnpm --filter @nexus/web-v2 test:run src/modules/chat/__tests__/mock-sse.transport.spec.ts`
Expected: 2 passed。

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/modules/chat/transport/mock-sse.transport.ts apps/web/src/modules/chat/__tests__/mock-sse.transport.spec.ts
git commit -m "feat(chat): mock SSE 传输 + 单测"
```

---

## Task 8: API 层补 feedback / delete

**Files:**
- Modify: `apps/web/src/modules/chat/api/chat.api.ts`

- [ ] **Step 1: 写完整新文件**

替换 `apps/web/src/modules/chat/api/chat.api.ts` 全文为：

```ts
import http from '@/api/client'
import type { ChatMessage, ChatSession } from '../types/chat'

export const chatApi = {
  listSessions(): Promise<ChatSession[]> {
    return http.get('/chat/sessions')
  },
  getSession(id: string): Promise<ChatSession> {
    return http.get(`/chat/sessions/${id}`)
  },
  createSession(data?: Partial<ChatSession>): Promise<ChatSession> {
    return http.post('/chat/sessions', data ?? {})
  },
  deleteSession(id: string): Promise<void> {
    return http.delete(`/chat/sessions/${id}`)
  },
  getMessages(sessionId: string): Promise<ChatMessage[]> {
    return http.get(`/chat/sessions/${sessionId}/messages`)
  },
  sendMessage(sessionId: string, content: string): Promise<ChatMessage> {
    return http.post(`/chat/sessions/${sessionId}/messages`, { content })
  },
  sendFeedback(messageId: string, action: 'like' | 'dislike', comment?: string): Promise<void> {
    // 线字段为 rating（对齐后端契约 POST /chat/messages/:id/feedback body {rating, comment?}）
    return http.post(`/chat/messages/${messageId}/feedback`, { rating: action, comment })
  },
}
```

> 注：`http` 是 `api/client.ts` 导出的 axios 实例。`deleteSession` 供会话列表删除用；`sendMessage`（REST 全量）保留供降级/测试，流式走 `useChatStream` + transport，不调它。

- [ ] **Step 2: 验证类型**

Run: `pnpm --filter @nexus/web-v2 check-types`
Expected: 无新增错误。

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/modules/chat/api/chat.api.ts
git commit -m "feat(chat): API 补 feedback + deleteSession"
```

---

## Task 9: useChatStream composable（TDD）

**Files:**
- Modify: `apps/web/src/modules/chat/composables/useChat.ts`
- Test: `apps/web/src/modules/chat/__tests__/useChatStream.spec.ts`

- [ ] **Step 1: 写失败测试**

Create `apps/web/src/modules/chat/__tests__/useChatStream.spec.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { defineComponent, h, ref } from 'vue'
import { mount } from '@vue/test-utils'
import { VueQueryPlugin, QueryClient } from '@tanstack/vue-query'
import { createMemoryHistory, createRouter } from 'vue-router'
import { useChatStream } from '../composables/useChat'
import type { ChatTransport, ChatStreamRequest } from '../transport/chat-transport'
import type { ChatStreamEvent } from '../types/chat'

// flush 微任务（历史查询 settle + async generator 推进）
const flush = () => new Promise((r) => setTimeout(r, 0))

function fakeTransport(events: ChatStreamEvent[]): ChatTransport {
  return {
    async *stream(_req: ChatStreamRequest): AsyncGenerator<ChatStreamEvent> {
      for (const e of events) yield e
    },
  }
}

describe('useChatStream', () => {
  it('send appends user + assistant placeholder and accumulates deltas', async () => {
    const sessionId = ref('s1')
    const transport = fakeTransport([
      { type: 'step', data: { step: 'retrieval' } },
      { type: 'delta', data: { content: 'Hel' } },
      { type: 'delta', data: { content: 'lo' } },
      { type: 'done', data: { messageId: 'm1', usage: { promptTokens: 1, completionTokens: 2, totalTokens: 3 } } },
    ])
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [{ path: '/', component: { render: () => h('div') } }],
    })
    let handle: any
    const Host = defineComponent({
      setup() {
        handle = useChatStream(sessionId, { transport })
        return () => h('div')
      },
    })
    mount(Host, { global: { plugins: [router, [VueQueryPlugin, { queryClient: qc }]] } })
    // 等待初始历史查询 settle（无后端 → 失败，不影响断言）
    await flush()
    await handle.send('hi')
    await flush()
    expect(handle.messages.value.map((m: any) => m.role)).toEqual(['user', 'assistant'])
    expect(handle.messages.value[1].content).toBe('Hello')
    expect(handle.phase.value).toBe('done')
  })
})
```

> 注：测试挂载一个含 `VueQueryPlugin` + 内存 router 的组件，捕获 composable 句柄，断言 send 后消息列表含 user+assistant、delta 累加、phase=done。

- [ ] **Step 2: 跑测试确认失败**

Run: `pnpm --filter @nexus/web-v2 test:run src/modules/chat/__tests__/useChatStream.spec.ts`
Expected: FAIL — `useChatStream` 未导出。

- [ ] **Step 3: 写实现（扩展 useChat.ts）**

替换 `apps/web/src/modules/chat/composables/useChat.ts` 全文为：

```ts
import { computed, ref, watch, type MaybeRef, toValue, type Ref } from 'vue'
import { useQuery, useMutation, useQueryClient } from '@tanstack/vue-query'
import { useRouter } from 'vue-router'
import { chatApi } from '@/modules/chat/api/chat.api'
import { applyStreamEvent } from './chat-stream-reducer'
import { FetchSseChatTransport } from '../transport/fetch-sse.transport'
import { MockSseChatTransport } from '../transport/mock-sse.transport'
import type { ChatMessage, ChatStreamEvent } from '../types/chat'
import type { ChatTransport, ChatStreamRequest } from '../transport/chat-transport'

const API_BASE = import.meta.env.VITE_API_URL || '/api/v1'

export function createChatTransport(): ChatTransport {
  if (import.meta.env.VITE_CHAT_MOCK === '1') return new MockSseChatTransport()
  return new FetchSseChatTransport({ baseUrl: API_BASE, getToken: () => localStorage.getItem('token') })
}

export function useChatSessions() {
  return useQuery({ queryKey: ['chat-sessions'], queryFn: () => chatApi.listSessions() })
}

export function useChatMessages(sessionId: MaybeRef<string>) {
  return useQuery({
    // 传 ref（非 toValue 快照）让 vue-query 跟踪并按解包值 hash；done 失效 ['chat-messages', sid] 可命中
    queryKey: ['chat-messages', sessionId],
    queryFn: () => chatApi.getMessages(toValue(sessionId) as string),
    enabled: () => !!toValue(sessionId) && toValue(sessionId) !== 'new',
  })
}

export function useSendMessage() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ sessionId, content }: { sessionId: string; content: string }) =>
      chatApi.sendMessage(sessionId, content),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['chat-messages', variables.sessionId] })
    },
  })
}

export interface ChatStreamHandle {
  messages: Ref<ChatMessage[]>
  streamingMessage: Ref<ChatMessage | null>
  phase: Ref<string>
  isStreaming: Ref<boolean>
  error: Ref<string | null>
  send: (content: string) => Promise<void>
  stop: () => void
  sendFeedback: (messageId: string, action: 'like' | 'dislike') => Promise<void>
}

export function useChatStream(sessionId: MaybeRef<string>, opts?: { transport?: ChatTransport }): ChatStreamHandle {
  const transport = opts?.transport ?? createChatTransport()
  const qc = useQueryClient()
  const router = useRouter()

  const history = useChatMessages(sessionId)
  const messages = ref<ChatMessage[]>([]) as Ref<ChatMessage[]>
  const streamingMessage = ref<ChatMessage | null>(null)
  const phase = ref<string>('idle')
  const error = ref<string | null>(null)
  const isStreaming = computed(
    () => phase.value === 'pendingCreate' || phase.value === 'retrieving' || phase.value === 'reranking' || phase.value === 'generating',
  )

  let abortController: AbortController | null = null

  watch(
    () => history.data.value,
    (data) => {
      // 仅当后端历史非空到达才替换线程；流式期间或历史拉取失败（无后端）时保留当前内容（spec §3.4，避免清空刚生成内容）
      if (!isStreaming.value && data && (data as ChatMessage[]).length) {
        messages.value = (data as ChatMessage[]).map((m) => ({ ...m }))
        streamingMessage.value = null
      }
    },
    { immediate: true },
  )

  function syncLast(msg: ChatMessage) {
    const arr = messages.value
    if (arr.length && arr[arr.length - 1].tempId === msg.tempId) {
      arr[arr.length - 1] = msg
    }
  }

  async function send(content: string) {
    const text = content.trim()
    if (!text || isStreaming.value) return
    error.value = null
    let sid = toValue(sessionId)
    if (sid === 'new') {
      phase.value = 'pendingCreate'
      try {
        const session = await chatApi.createSession()
        sid = session.id
        router.replace(`/chat/${sid}`)
      } catch {
        phase.value = 'error'
        error.value = '创建会话失败'
        return
      }
    }
    // 局部闭包捕获 sid：done 时按真实 sid 失效历史查询（避免路由尚未更新时命中 'new'）
    const handleEvent = (ev: ChatStreamEvent) => {
      if (!streamingMessage.value) return
      const state = applyStreamEvent({ message: streamingMessage.value, phase: phase.value as any }, ev)
      phase.value = state.phase
      streamingMessage.value = state.message
      syncLast(state.message)
      if (ev.type === 'done') {
        qc.invalidateQueries({ queryKey: ['chat-messages', sid] })
      }
    }

    abortController = new AbortController()
    const tempId = `temp-${Math.random().toString(36).slice(2)}`
    const placeholder: ChatMessage = {
      tempId, sessionId: sid, role: 'assistant', content: '',
      streaming: true, phase: 'retrieving', citations: [],
    }
    const userMsg: ChatMessage = {
      tempId: `u-${Math.random().toString(36).slice(2)}`, sessionId: sid, role: 'user', content: text,
    }
    messages.value = [...messages.value, userMsg, placeholder]
    streamingMessage.value = placeholder
    phase.value = 'retrieving'
    try {
      const req: ChatStreamRequest = { sessionId: sid, content: text, signal: abortController.signal }
      for await (const ev of transport.stream(req)) handleEvent(ev)
    } catch (e: any) {
      if (e?.name === 'AbortError') {
        phase.value = 'aborted'
        if (streamingMessage.value) {
          streamingMessage.value = { ...streamingMessage.value, streaming: false, phase: 'aborted' }
          syncLast(streamingMessage.value)
        }
      } else {
        phase.value = 'error'
        error.value = e?.message ?? '网络错误'
        if (streamingMessage.value) {
          streamingMessage.value = { ...streamingMessage.value, streaming: false, phase: 'error', error: error.value }
          syncLast(streamingMessage.value)
        }
      }
    } finally {
      abortController = null
    }
  }

  function stop() {
    abortController?.abort()
  }

  async function sendFeedback(messageId: string, action: 'like' | 'dislike') {
    await chatApi.sendFeedback(messageId, action)
    const m = messages.value.find((x) => x.id === messageId)
    if (m) m.feedback = action
  }

  return { messages, streamingMessage, phase, isStreaming, error, send, stop, sendFeedback }
}
```

- [ ] **Step 4: 跑测试确认通过**

Run: `pnpm --filter @nexus/web-v2 test:run src/modules/chat/__tests__/useChatStream.spec.ts`
Expected: 1 passed。

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/modules/chat/composables/useChat.ts apps/web/src/modules/chat/__tests__/useChatStream.spec.ts
git commit -m "feat(chat): useChatStream 流式 composable + 状态机单测"
```

---

## Task 10: render-markdown 工具

**Files:**
- Create: `apps/web/src/modules/chat/utils/render-markdown.ts`

- [ ] **Step 1: 写实现**

```ts
import MarkdownIt from 'markdown-it'
import DOMPurify from 'dompurify'

const md = new MarkdownIt({ html: false, linkify: true, breaks: true })

export function renderMarkdown(src: string): string {
  if (!src) return ''
  return DOMPurify.sanitize(md.render(src), { USE_PROFILES: { html: true } })
}
```

- [ ] **Step 2: 验证类型**

Run: `pnpm --filter @nexus/web-v2 check-types`
Expected: 无错误。

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/modules/chat/utils/render-markdown.ts
git commit -m "feat(chat): markdown 渲染工具（markdown-it + DOMPurify）"
```

---

## Task 11: CitationsCard 组件（TDD）

**Files:**
- Create: `apps/web/src/modules/chat/components/CitationsCard.vue`
- Test: `apps/web/src/modules/chat/__tests__/CitationsCard.spec.ts`

- [ ] **Step 1: 写失败测试**

Create `apps/web/src/modules/chat/__tests__/CitationsCard.spec.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import CitationsCard from '../components/CitationsCard.vue'
import type { Citation } from '../types/chat'

const citations: Citation[] = [
  { documentName: 'a.pdf', page: 12, snippet: '片段 A', score: 0.92 },
  { documentName: 'b.pdf', page: 3, snippet: '片段 B', score: 0.85 },
]

describe('CitationsCard', () => {
  it('shows collapsed chip count and expands on click', async () => {
    const wrapper = mount(CitationsCard, { props: { citations } })
    expect(wrapper.text()).toContain('2 条来源')
    expect(wrapper.text()).not.toContain('a.pdf')
    await wrapper.find('[data-testid="citations-toggle"]').trigger('click')
    expect(wrapper.text()).toContain('a.pdf')
    expect(wrapper.text()).toContain('b.pdf')
  })

  it('renders nothing when citations empty', () => {
    const wrapper = mount(CitationsCard, { props: { citations: [] } })
    expect(wrapper.find('[data-testid="citations-toggle"]').exists()).toBe(false)
  })
})
```

- [ ] **Step 2: 跑测试确认失败**

Run: `pnpm --filter @nexus/web-v2 test:run src/modules/chat/__tests__/CitationsCard.spec.ts`
Expected: FAIL — 组件不存在。

- [ ] **Step 3: 写实现**

Create `apps/web/src/modules/chat/components/CitationsCard.vue`:

```vue
<script setup lang="ts">
import { ref } from 'vue'
import type { Citation } from '../types/chat'

const props = defineProps<{ citations: Citation[] }>()
const expanded = ref(false)
</script>

<template>
  <div v-if="citations.length" class="mt-2">
    <button
      data-testid="citations-toggle"
      type="button"
      class="inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 text-xs transition-colors"
      :style="{
        backgroundColor: expanded ? 'var(--accent-soft)' : 'var(--surface-secondary)',
        color: 'var(--foreground)',
        borderColor: 'var(--border)',
      }"
      @click="expanded = !expanded"
    >
      <span>📎 {{ citations.length }} 条来源</span>
      <span>{{ expanded ? '▴' : '▾' }}</span>
    </button>

    <ol v-if="expanded" class="mt-2 space-y-1.5">
      <li
        v-for="(c, i) in citations"
        :key="i"
        class="rounded-md border px-2.5 py-1.5 text-xs"
        :style="{ backgroundColor: 'var(--surface-secondary)', borderColor: 'var(--border)' }"
      >
        <div class="flex items-center justify-between gap-2" :style="{ color: 'var(--foreground)' }">
          <span class="font-medium">{{ i + 1 }}. {{ c.documentName }}<span v-if="c.page"> · p{{ c.page }}</span></span>
          <span v-if="c.score != null" class="font-mono text-[10px] opacity-60">{{ c.score.toFixed(2) }}</span>
        </div>
        <p v-if="c.snippet" class="mt-0.5 line-clamp-2 opacity-70">{{ c.snippet }}</p>
      </li>
    </ol>
  </div>
</template>
```

- [ ] **Step 4: 跑测试确认通过**

Run: `pnpm --filter @nexus/web-v2 test:run src/modules/chat/__tests__/CitationsCard.spec.ts`
Expected: 2 passed。

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/modules/chat/components/CitationsCard.vue apps/web/src/modules/chat/__tests__/CitationsCard.spec.ts
git commit -m "feat(chat): CitationsCard 折叠引用卡片 + 组件测试"
```

---

## Task 12: ChatStreamStatus 组件

**Files:**
- Create: `apps/web/src/modules/chat/components/ChatStreamStatus.vue`

- [ ] **Step 1: 写实现**

```vue
<script setup lang="ts">
import { computed } from 'vue'
import type { MessagePhase } from '../types/chat'

const props = defineProps<{ phase: MessagePhase; message?: string }>()

const labelMap: Record<string, string> = {
  retrieving: '正在检索知识库…',
  reranking: '正在精排结果…',
  generating: '正在生成回答…',
  pendingCreate: '正在创建会话…',
}

const visible = computed(() => ['retrieving', 'reranking', 'generating', 'pendingCreate'].includes(props.phase))
const label = computed(() => props.message || labelMap[props.phase] || '')
</script>

<template>
  <div
    v-if="visible"
    class="flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs"
    :style="{ backgroundColor: 'var(--accent-soft)', color: 'var(--accent)' }"
  >
    <span class="inline-block h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" />
    <span>{{ label }}</span>
  </div>
</template>
```

- [ ] **Step 2: 验证类型**

Run: `pnpm --filter @nexus/web-v2 check-types`
Expected: 无错误。

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/modules/chat/components/ChatStreamStatus.vue
git commit -m "feat(chat): ChatStreamStatus 阶段横幅"
```

---

## Task 13: ChatMessage 重写（TDD）

**Files:**
- Rewrite: `apps/web/src/modules/chat/components/ChatMessage.vue`
- Test: `apps/web/src/modules/chat/__tests__/ChatMessage.spec.ts`

- [ ] **Step 1: 写失败测试**

Create `apps/web/src/modules/chat/__tests__/ChatMessage.spec.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import ChatMessage from '../components/ChatMessage.vue'
import type { ChatMessage as ChatMessageType } from '../types/chat'

const base: ChatMessageType = {
  tempId: 't1', sessionId: 's1', role: 'assistant',
  content: '# Title\n\nsome **bold**', citations: [], streaming: false, phase: 'done',
}

describe('ChatMessage', () => {
  it('renders markdown for assistant', () => {
    const wrapper = mount(ChatMessage, { props: { message: base } })
    expect(wrapper.html()).toContain('<h1>Title</h1>')
    expect(wrapper.html()).toContain('<strong>bold</strong>')
  })

  it('renders plain text for user', () => {
    const wrapper = mount(ChatMessage, { props: { message: { ...base, role: 'user', content: '<b>not html</b>' } } })
    expect(wrapper.html()).not.toContain('<b>not html</b>')
    expect(wrapper.text()).toContain('<b>not html</b>')
  })

  it('shows streaming cursor when streaming', () => {
    const wrapper = mount(ChatMessage, { props: { message: { ...base, streaming: true, content: 'partial' } } })
    expect(wrapper.find('[data-testid="stream-cursor"]').exists()).toBe(true)
  })

  it('emits feedback action on click', async () => {
    const wrapper = mount(ChatMessage, { props: { message: { ...base, id: 'm1' } } })
    await wrapper.find('[data-testid="feedback-like"]').trigger('click')
    expect(wrapper.emitted('feedback')?.[0]).toEqual(['m1', 'like'])
  })

  it('renders citations card when citations present', () => {
    const wrapper = mount(ChatMessage, {
      props: { message: { ...base, citations: [{ documentName: 'a.pdf', page: 1, score: 0.9 }] } },
    })
    expect(wrapper.text()).toContain('1 条来源')
  })
})
```

- [ ] **Step 2: 跑测试确认失败**

Run: `pnpm --filter @nexus/web-v2 test:run src/modules/chat/__tests__/ChatMessage.spec.ts`
Expected: FAIL — markdown 未渲染 / 组件行为不符旧版。

- [ ] **Step 3: 重写组件**

替换 `apps/web/src/modules/chat/components/ChatMessage.vue` 全文为：

```vue
<script setup lang="ts">
import { computed } from 'vue'
import { useClipboard } from '@vueuse/core'
import { renderMarkdown } from '../utils/render-markdown'
import CitationsCard from './CitationsCard.vue'
import type { ChatMessage } from '../types/chat'

const props = defineProps<{ message: ChatMessage }>()
const emit = defineEmits<{
  (e: 'feedback', messageId: string, action: 'like' | 'dislike'): void
}>()

const isUser = computed(() => props.message.role === 'user')
const html = computed(() => (isUser.value ? '' : renderMarkdown(props.message.content)))
const showCursor = computed(() => !!props.message.streaming)
const showTokens = computed(() => props.message.totalTokens != null)
const { copy, copied } = useClipboard()

function onCopy() {
  copy(props.message.content)
}
function onFeedback(action: 'like' | 'dislike') {
  if (props.message.id) emit('feedback', props.message.id, action)
}
</script>

<template>
  <div class="flex gap-3 py-2" :class="isUser ? 'flex-row-reverse' : ''">
    <!-- 头像 -->
    <div
      v-if="!isUser"
      class="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs"
      :style="{ backgroundColor: 'var(--accent)', color: '#fff' }"
    >AI</div>

    <div class="max-w-[80%]">
      <div
        class="rounded-2xl px-4 py-2 text-sm leading-relaxed"
        :style="isUser
          ? { backgroundColor: 'var(--accent)', color: '#fff' }
          : { backgroundColor: 'var(--surface)', color: 'var(--foreground)', border: '1px solid var(--border)' }"
      >
        <div v-if="isUser">{{ message.content }}</div>
        <div v-else class="prose-chat" v-html="html" />
        <span
          v-if="showCursor"
          data-testid="stream-cursor"
          class="ml-0.5 inline-block w-[2px] h-[1em] align-middle animate-pulse"
          :style="{ backgroundColor: 'var(--accent)' }"
        />
      </div>

      <CitationsCard v-if="!isUser && message.citations?.length" :citations="message.citations!" />

      <!-- 页脚：反馈 / 复制 / token（仅 assistant 且 done） -->
      <div
        v-if="!isUser && !message.streaming"
        class="mt-1 flex items-center gap-3 text-[11px]"
        :style="{ color: 'var(--foreground)' }"
      >
        <button
          data-testid="feedback-like"
          class="opacity-60 transition-opacity hover:opacity-100"
          :class="message.feedback === 'like' ? 'opacity-100' : ''"
          @click="onFeedback('like')"
        >👍</button>
        <button
          class="opacity-60 transition-opacity hover:opacity-100"
          :class="message.feedback === 'dislike' ? 'opacity-100' : ''"
          @click="onFeedback('dislike')"
        >👎</button>
        <button class="opacity-60 transition-opacity hover:opacity-100" @click="onCopy">
          {{ copied ? '已复制' : '复制' }}
        </button>
        <span v-if="showTokens" class="font-mono opacity-50">
          {{ message.promptTokens }}/{{ message.completionTokens }}/{{ message.totalTokens }}
        </span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.prose-chat :deep(code) {
  font-family: var(--font-mono, monospace);
  background-color: var(--surface-secondary);
  padding: 0.1rem 0.3rem;
  border-radius: 0.25rem;
}
.prose-chat :deep(pre) {
  background-color: var(--surface-secondary);
  padding: 0.75rem;
  border-radius: 0.5rem;
  overflow-x: auto;
}
.prose-chat :deep(p) { margin: 0.4rem 0; }
.prose-chat :deep(ul), .prose-chat :deep(ol) { margin: 0.4rem 0; padding-left: 1.25rem; }
.prose-chat :deep(a) { color: var(--accent); text-decoration: underline; }
</style>
```

- [ ] **Step 4: 跑测试确认通过**

Run: `pnpm --filter @nexus/web-v2 test:run src/modules/chat/__tests__/ChatMessage.spec.ts`
Expected: 5 passed。

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/modules/chat/components/ChatMessage.vue apps/web/src/modules/chat/__tests__/ChatMessage.spec.ts
git commit -m "feat(chat): ChatMessage 重写 — markdown/流式光标/引用/反馈/token"
```

---

## Task 14: ChatInput 升级（TDD）

**Files:**
- Modify: `apps/web/src/modules/chat/components/ChatInput.vue`
- Test: `apps/web/src/modules/chat/__tests__/ChatInput.spec.ts`

- [ ] **Step 1: 写失败测试**

Create `apps/web/src/modules/chat/__tests__/ChatInput.spec.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import ChatInput from '../components/ChatInput.vue'

describe('ChatInput', () => {
  it('emits send on Enter (no shift) and clears', async () => {
    const wrapper = mount(ChatInput)
    const textarea = wrapper.find('textarea')
    await textarea.setValue('hi')
    await textarea.trigger('keydown', { key: 'Enter' })
    expect(wrapper.emitted('send')?.[0]).toEqual(['hi'])
    expect((wrapper.find('textarea').element as HTMLTextAreaElement).value).toBe('')
  })

  it('does not emit send on Shift+Enter', async () => {
    const wrapper = mount(ChatInput)
    const textarea = wrapper.find('textarea')
    await textarea.setValue('hi')
    await textarea.trigger('keydown', { key: 'Enter', shiftKey: true })
    expect(wrapper.emitted('send')).toBeUndefined()
  })

  it('shows Stop button and emits stop when streaming', async () => {
    const wrapper = mount(ChatInput, { props: { streaming: true } })
    expect(wrapper.find('[data-testid="stop-btn"]').exists()).toBe(true)
    await wrapper.find('[data-testid="stop-btn"]').trigger('click')
    expect(wrapper.emitted('stop')).toBeTruthy()
  })
})
```

- [ ] **Step 2: 跑测试确认失败**

Run: `pnpm --filter @nexus/web-v2 test:run src/modules/chat/__tests__/ChatInput.spec.ts`
Expected: FAIL — 当前用 `el-input` 无 `<textarea>` 选择器命中 / 无 Stop。

- [ ] **Step 3: 重写组件**

替换 `apps/web/src/modules/chat/components/ChatInput.vue` 全文为：

```vue
<script setup lang="ts">
import { ref, nextTick, onMounted } from 'vue'
import { Promotion, VideoPause } from '@element-plus/icons-vue'

const props = defineProps<{ streaming?: boolean }>()
const emit = defineEmits<{
  (e: 'send', content: string): void
  (e: 'stop'): void
}>()

const content = ref('')
const textareaRef = ref<HTMLTextAreaElement | null>(null)

function autosize() {
  const el = textareaRef.value
  if (!el) return
  el.style.height = 'auto'
  el.style.height = Math.min(el.scrollHeight, 168) + 'px'
}

async function onInput() {
  await nextTick()
  autosize()
}

function onEnter(e: KeyboardEvent) {
  if (props.streaming) return
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault()
    submit()
  }
}

function submit() {
  const text = content.value.trim()
  if (!text || props.streaming) return
  emit('send', text)
  content.value = ''
  nextTick(autosize)
}

onMounted(() => autosize())
</script>

<template>
  <div
    class="flex items-end gap-2 border-t p-3"
    :style="{ borderColor: 'var(--border)', backgroundColor: 'var(--surface)' }"
  >
    <textarea
      ref="textareaRef"
      v-model="content"
      rows="1"
      placeholder="输入问题，Enter 发送，Shift+Enter 换行"
      class="flex-1 resize-none rounded-lg px-3 py-2 text-sm outline-none"
      :style="{
        backgroundColor: 'var(--surface-secondary)',
        color: 'var(--foreground)',
        border: '1px solid var(--border)',
      }"
      :disabled="streaming"
      @input="onInput"
      @keydown="onEnter"
    />
    <button
      v-if="!streaming"
      class="flex h-9 w-9 items-center justify-center rounded-lg text-white transition-opacity disabled:opacity-40"
      :style="{ backgroundColor: 'var(--accent)' }"
      :disabled="!content.trim()"
      @click="submit"
    >
      <el-icon :size="16"><Promotion /></el-icon>
    </button>
    <button
      v-else
      data-testid="stop-btn"
      class="flex h-9 w-9 items-center justify-center rounded-lg"
      :style="{ backgroundColor: 'var(--accent-soft)', color: 'var(--accent)' }"
      @click="emit('stop')"
    >
      <el-icon :size="16"><VideoPause /></el-icon>
    </button>
  </div>
</template>
```

- [ ] **Step 4: 跑测试确认通过**

Run: `pnpm --filter @nexus/web-v2 test:run src/modules/chat/__tests__/ChatInput.spec.ts`
Expected: 3 passed。

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/modules/chat/components/ChatInput.vue apps/web/src/modules/chat/__tests__/ChatInput.spec.ts
git commit -m "feat(chat): ChatInput 升级 — textarea/Enter/Shift+Enter/Stop"
```

---

## Task 15: ChatSessionList 更丰富条目

**Files:**
- Modify: `apps/web/src/modules/chat/components/ChatSessionList.vue`

- [ ] **Step 1: 重写组件**

替换 `apps/web/src/modules/chat/components/ChatSessionList.vue` 全文为：

```vue
<script setup lang="ts">
import { computed } from 'vue'
import { Plus } from '@element-plus/icons-vue'
import dayjs from 'dayjs'
import relativeTime from 'dayjs/plugin/relativeTime'
import { useChatSessions } from '../composables/useChat'

dayjs.extend(relativeTime)

defineProps<{ activeId?: string }>()
const emit = defineEmits<{ (e: 'select', id: string): void; (e: 'new'): void }>()

const { data, isLoading } = useChatSessions()
const sessions = computed(() => (data.value as any[]) ?? [])
</script>

<template>
  <aside class="flex h-full w-[260px] flex-col border-r" :style="{ borderColor: 'var(--border)' }">
    <div class="p-3">
      <el-button type="primary" class="w-full" :icon="Plus" @click="emit('new')">新会话</el-button>
    </div>

    <div class="flex-1 overflow-y-auto px-2 pb-2">
      <template v-if="isLoading">
        <div v-for="i in 5" :key="i" class="px-3 py-3">
          <el-skeleton :rows="2" animated />
        </div>
      </template>

      <el-empty v-else-if="sessions.length === 0" description="暂无会话" />

      <ul v-else class="space-y-1">
        <li
          v-for="s in sessions"
          :key="s.id"
          class="group cursor-pointer rounded-lg px-3 py-2 transition-colors"
          :style="s.id === activeId
            ? { backgroundColor: 'var(--accent-soft)' }
            : {}"
          @click="emit('select', s.id)"
        >
          <div class="flex items-center justify-between gap-2">
            <span class="truncate text-sm font-medium" :style="{ color: 'var(--foreground)' }">{{ s.title }}</span>
            <el-tag v-if="s.workflowType" size="small" effect="plain">{{ s.workflowType }}</el-tag>
          </div>
          <div class="mt-0.5 flex items-center justify-between text-[11px] opacity-60" :style="{ color: 'var(--foreground)' }">
            <span class="truncate">{{ s.lastMessage?.content ?? '新会话' }}</span>
            <span>{{ s.createdAt ? dayjs(s.createdAt).fromNow() : '' }}</span>
          </div>
        </li>
      </ul>
    </div>
  </aside>
</template>
```

- [ ] **Step 2: 验证类型**

Run: `pnpm --filter @nexus/web-v2 check-types`
Expected: 无新增错误。

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/modules/chat/components/ChatSessionList.vue
git commit -m "feat(chat): ChatSessionList 丰富条目 — 预览/时间/标签"
```

---

## Task 16: ChatEmptyState 组件

**Files:**
- Create: `apps/web/src/modules/chat/components/ChatEmptyState.vue`

- [ ] **Step 1: 写实现**

```vue
<script setup lang="ts">
const props = defineProps<{ title?: string; suggestions?: string[] }>()
const emit = defineEmits<{ (e: 'suggest', text: string): void }>()
const fallback = ['这个知识库包含哪些文档？', '请帮我总结最新的规定', '常见问题有哪些？']
const list = props.suggestions?.length ? props.suggestions : fallback
</script>

<template>
  <div class="flex h-full flex-col items-center justify-center gap-3 px-6 text-center">
    <h2 class="text-lg font-semibold" :style="{ color: 'var(--foreground)' }">
      {{ title ?? '开始对话' }}
    </h2>
    <p class="text-sm opacity-60" :style="{ color: 'var(--foreground)' }">
      输入问题，或试试以下建议：
    </p>
    <div class="flex flex-wrap justify-center gap-2">
      <button
        v-for="s in list"
        :key="s"
        class="rounded-full border px-3 py-1 text-xs transition-colors hover:bg-[var(--accent-soft)]"
        :style="{ borderColor: 'var(--border)', color: 'var(--foreground)' }"
        @click="emit('suggest', s)"
      >{{ s }}</button>
    </div>
  </div>
</template>
```

- [ ] **Step 2: 验证类型**

Run: `pnpm --filter @nexus/web-v2 check-types`
Expected: 无错误。

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/modules/chat/components/ChatEmptyState.vue
git commit -m "feat(chat): ChatEmptyState 欢迎态 + 建议问题"
```

---

## Task 17: ChatSession 视图编排

**Files:**
- Modify: `apps/web/src/modules/chat/views/ChatSession.vue`

- [ ] **Step 1: 重写视图**

替换 `apps/web/src/modules/chat/views/ChatSession.vue` 全文为：

```vue
<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useChatStream } from '../composables/useChat'
import ChatSessionList from '../components/ChatSessionList.vue'
import ChatMessage from '../components/ChatMessage.vue'
import ChatInput from '../components/ChatInput.vue'
import ChatStreamStatus from '../components/ChatStreamStatus.vue'
import ChatEmptyState from '../components/ChatEmptyState.vue'

const route = useRoute()
const router = useRouter()

// 用 ref + watch 跟随路由（/chat/new → createSession 后 router.replace 切到真 id），
// 保证 useChatStream 内部 toValue(sessionId) 在 done 失效时命中正确 query key
const sessionId = ref(String(route.params.sessionId ?? ''))
watch(() => route.params.sessionId, (v) => { sessionId.value = String(v ?? '') })
const { messages, phase, isStreaming, error, send, stop, sendFeedback } = useChatStream(sessionId)

const threadRef = ref<HTMLElement | null>(null)
const showScrollBtn = ref(false)

const isEmpty = computed(() => !isStreaming.value && messages.value.length === 0)

async function scrollToBottom() {
  await nextTick()
  const el = threadRef.value
  if (el) el.scrollTop = el.scrollHeight
}

watch(() => messages.value.length, scrollToBottom)
// 流式增量时也贴底
watch(
  () => messages.value[messages.value.length - 1]?.content,
  scrollToBottom,
)

function onScroll() {
  const el = threadRef.value
  if (!el) return
  showScrollBtn.value = el.scrollTop + el.clientHeight < el.scrollHeight - 80
}

function onSelect(id: string) { router.push(`/chat/${id}`) }
function onNew() { router.push('/chat/new') }
function onSuggest(text: string) { send(text) }
function onFeedback(messageId: string, action: 'like' | 'dislike') { sendFeedback(messageId, action) }
</script>

<template>
  <div class="flex h-full -m-6">
    <ChatSessionList :active-id="sessionId" @select="onSelect" @new="onNew" />

    <section class="flex flex-1 flex-col">
      <header
        class="flex items-center justify-between border-b px-4 py-3"
        :style="{ borderColor: 'var(--border)', backgroundColor: 'var(--surface)' }"
      >
        <span class="text-sm font-medium" :style="{ color: 'var(--foreground)' }">
          {{ sessionId === 'new' ? '新会话' : '对话' }}
        </span>
      </header>

      <div ref="threadRef" class="relative flex-1 overflow-y-auto px-4 py-4" @scroll="onScroll">
        <ChatEmptyState v-if="isEmpty" @suggest="onSuggest" />

        <template v-else>
          <ChatStreamStatus :phase="phase" />
          <div v-if="error" class="my-2 rounded-lg px-3 py-2 text-sm text-red-500" style="background: var(--accent-soft)">
            {{ error }} <button class="underline" @click="send(messages[messages.length-2]?.content ?? '')">重试</button>
          </div>
          <TransitionGroup name="msg" tag="div">
            <ChatMessage
              v-for="m in messages"
              :key="m.id ?? m.tempId"
              :message="m"
              @feedback="onFeedback"
            />
          </TransitionGroup>
        </template>
      </div>

      <button
        v-if="showScrollBtn"
        class="absolute bottom-24 right-6 rounded-full border px-3 py-1 text-xs shadow"
        :style="{ borderColor: 'var(--border)', backgroundColor: 'var(--surface)' }"
        @click="scrollToBottom"
      >↓ 回到底部</button>

      <ChatInput :streaming="isStreaming" @send="send" @stop="stop" />
    </section>
  </div>
</template>

<style scoped>
.msg-enter-active { transition: opacity 200ms ease-out, transform 200ms ease-out; }
.msg-enter-from { opacity: 0; transform: translateY(6px); }
</style>
```

- [ ] **Step 2: 验证类型**

Run: `pnpm --filter @nexus/web-v2 check-types`
Expected: 无新增错误。

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/modules/chat/views/ChatSession.vue
git commit -m "feat(chat): ChatSession 编排 — 流式/自动滚动/空态/反馈"
```

---

## Task 18: ChatList 落地页

**Files:**
- Modify: `apps/web/src/modules/chat/views/ChatList.vue`

- [ ] **Step 1: 重写视图**

替换 `apps/web/src/modules/chat/views/ChatList.vue` 全文为：

```vue
<script setup lang="ts">
import { useRouter } from 'vue-router'
import ChatSessionList from '../components/ChatSessionList.vue'
import ChatEmptyState from '../components/ChatEmptyState.vue'

const router = useRouter()
function onSelect(id: string) { router.push(`/chat/${id}`) }
function onNew() { router.push('/chat/new') }
function onSuggest() { onNew() }
</script>

<template>
  <div class="flex h-full -m-6">
    <ChatSessionList @select="onSelect" @new="onNew" />
    <section class="flex flex-1 items-center justify-center">
      <ChatEmptyState
        title="开始一个新的对话"
        :suggestions="['新建会话', '查看历史对话', '了解知识库内容']"
        @suggest="onSuggest"
      />
    </section>
  </div>
</template>
```

- [ ] **Step 2: 验证类型**

Run: `pnpm --filter @nexus/web-v2 check-types`
Expected: 无新增错误。

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/modules/chat/views/ChatList.vue
git commit -m "feat(chat): ChatList 落地页 — 列表 + 空态"
```

---

## Task 19: dev-mock 接线 + 手动验证

**Files:**
- Modify: `apps/web/.env`（或新建 `.env.local`）
- Create: `apps/web/.env.example`

- [ ] **Step 1: 加 env 示例**

Create `apps/web/.env.example`:

```
# 留空走真实 SSE；置 1 用内置 mock（后端未上线时演示用）
VITE_CHAT_MOCK=
```

- [ ] **Step 2: 写本地 mock env**

Create `apps/web/.env.local`:

```
VITE_CHAT_MOCK=1
```

> 注：`.env.local` 通常已在 `.gitignore`，不入库；仅本机启用 mock。演示真实后端时删除该文件或置空。

- [ ] **Step 3: 跑全量测试 + 类型检查**

Run: `pnpm --filter @nexus/web-v2 test:run`
Expected: 全部通过。

Run: `pnpm --filter @nexus/web-v2 check-types`
Expected: 无错误。

- [ ] **Step 4: 启动 dev server 手动验证（mock 模式）**

Run: `pnpm --filter @nexus/web-v2 dev`
手动验证（浏览器开 http://localhost:3034 ）：
1. 进入 `/chat` → 看到会话列表 + 空态/建议。
2. 点「新会话」→ 跳 `/chat/new`。
3. 输入问题 Enter → 顶部出现「正在检索知识库…」横幅 → 助手气泡逐字打字（带闪烁光标）→ 引用卡 `📎 2 条来源` 折叠展开 → done 显示 token → 👍 反馈可点。
4. 流式中点 Stop → 中断。
5. 切主题（Uber/Coinbase/Rabbit）+ 暗色 → 配色跟随，无错位。
6. Markdown：含标题/列表/代码块 → 正确渲染。

Expected: 上述全部正常。

- [ ] **Step 5: 关 mock 接真实后端回归（若 P2 后端已就绪）**

删除 `.env.local`（或置 `VITE_CHAT_MOCK=`），重启 dev，确认 fetch 直连 `/api/v1/chat/sessions/:id/messages` 走真实 SSE。若后端未就绪，跳过此步并在 PR 说明。

- [ ] **Step 6: Commit env 示例**

```bash
git add apps/web/.env.example
git commit -m "chore(web): chat mock env 示例 + 手动验证通过"
```

---

## 自检（写计划后）

- **Spec 覆盖**: §1 决策 → 全计划覆盖；§2 架构/组件 → Task 4-18；§3 状态机/解析/mock → Task 5,6,7,9；§3.4 调和 → Task 9 watcher（仅后端历史非空到达才替换线程；done 后失效 `['chat-messages', sid]` 触发 refetch 调和）；§4 视觉 → Task 11-18；§5 类型 → Task 3；§6 测试 → Task 1,5,6,7,9,11,13,14 + Task 19 全量；§7 假设 → SSE 格式(Task 6)、fetch 直连(Task 6)、feedback 字段 `rating`(Task 8)、/chat/new(Task 9)、markdown 依赖(Task 2)。无遗漏。
- **占位符扫描**: 无 TBD/TODO；每步含实代码与命令。
- **类型一致性**: `useChatStream` 返回的 `messages/streamingMessage/phase/isStreaming/error/send/stop/sendFeedback` 与视图使用一致；`ChatTransport.stream` 签名贯穿 fetch/mock；`applyStreamEvent` 入参 `ReduceState` 与 Task 5/9 一致；`ChatMessage.tempId` 去重键在 Task 9 send 与 syncLast 一致；`chatApi.sendFeedback` 线字段 `rating` 与后端契约（plan Task 2.4）一致；`api/client.ts` 默认导出 `http`（非命名导出），Task 8 import 已对齐；axios `baseURL='/api/v1'` 已含前缀，Task 8 路径不带 `/api/v1`（修复原 chat.api.ts 双前缀 latent bug）。
- **已知偏差（YAGNI）**: spec §6.2 列 ChatSessionList 组件测试，但该组件纯展示 + 强依赖 `useChatSessions`(vue-query) 与 ElementPlus 全家桶，mock 成本高收益低，改由 Task 19 手动验证覆盖（切会话/列表/空态/主题）。若执行方需要单测可补 `vi.mock('../composables/useChat')` + `ref()` 桩。
- **遗留待执行时注意**: Task 9 composable 测试的 fake transport 同步 yield（无 sleep），用 `flush()` 推进微任务即可，不依赖 fake timers；Task 7 mock 测试用真实定时器 + `{stepDelay:1,deltaDelay:1}`（fake timers 下 `for await` 会阻塞在内部 `sleep` 上）；Task 9 `useChatMessages` 的 `queryKey` 传 `sessionId` ref（非 `toValue` 快照）以保 vue-query 跟踪与失效命中；ChatSession 用 `ref+watch(route)` 而非 `computed`（`computed<string>` 对 `MaybeRef<string>` 形参的赋值性存疑，沿用既有文件 `ref` 模式更稳）。
