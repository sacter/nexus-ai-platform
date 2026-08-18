# Chat 模块展示优化实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 按 `docs/superpowers/specs/2026-08-18-chat-display-optimization-design.md` 对 chat 模块做视觉升级 + 轻度重排：浮岛卡片布局、居中单栏消息区、品牌 hero 空状态、修复深色 uber 主题白底白字。

**Architecture:** 仅改 `apps/web/src/modules/chat/**` 与 `apps/web/src/styles/globals.css`（新增 `--accent-foreground` token 与 `.chat-island` 类）。组件结构、composables、transport、API 均不动；全部 5 个 `data-testid` 保留。

**Tech Stack:** Vue 3 SFC + Element Plus 2.10 + Tailwind CSS 4（`@theme` token）+ Vitest + @vue/test-utils。

**关键命令**（在仓库根目录执行）：
- 跑 chat 模块测试：`pnpm --filter web test:run -- src/modules/chat`
- 类型检查：`pnpm --filter web check-types`
- Lint：`pnpm --filter web lint`

**提交规范**：遵循仓库现有风格（如 `fix(chat): …`），中文摘要，**不要**添加任何 Co-Authored-By trailer（用户已明确要求全 scater 署名）。

---

### Task 1: globals.css — `--accent-foreground` token + `.chat-island` 类

**Files:**
- Modify: `apps/web/src/styles/globals.css`

- [ ] **Step 1: 在 `@theme` 块注册 token**

在 `apps/web/src/styles/globals.css` 的 `@theme {` 块内（`--color-foreground` 行之后）加一行：

```css
  --color-accent-foreground: var(--accent-foreground);
```

- [ ] **Step 2: 为 6 组主题定义 `--accent-foreground`**

在 `:root` 的「主题派生 token」注释块中（`--grid-line-strong` 行之后）加一行并补注释：

```css
  /* accent 底色上的文字色（深色 uber accent 为白，需回深色） */
  --accent-foreground: oklch(100% 0 0);
```

然后在各主题块中覆盖：

- `html.dark, html.dark[data-theme="uber"]` 块（`--accent` 行之后）：

```css
  --accent-foreground: oklch(21.03% 0.0000 0.00);
```

- `[data-theme="coinbase"]` 块、`html.dark[data-theme="coinbase"]` 块、`[data-theme="rabbit"]` 块、`html.dark[data-theme="rabbit"]` 块（各自 `--accent` 行之后）均为：

```css
  --accent-foreground: oklch(100% 0 0);
```

（`:root, [data-theme="uber"]` 块使用 :root 已定义的默认白色，无需重复。）

- [ ] **Step 3: 新增 `.chat-island` 工具类**

在 `.nexus-main` 规则之后追加：

```css
/* chat 浮岛卡片 — 与 el-card 阴影语言一致 */
.chat-island {
  box-shadow: 0 12px 16px -12px var(--accent-glow);
}
```

- [ ] **Step 4: 验证**

Run: `pnpm --filter web build`
Expected: 构建通过（CSS 语法无错）。

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/styles/globals.css
git commit -m "feat(web): 新增 --accent-foreground 主题 token 与 .chat-island 类"
```

---

### Task 2: CitationsCard — 图标化 + `.num` + hover

**Files:**
- Modify: `apps/web/src/modules/chat/components/CitationsCard.vue`
- Test: `apps/web/src/modules/chat/__tests__/CitationsCard.spec.ts`

- [ ] **Step 1: 先改测试断言（score class 从 `.font-mono` 改为 `.num`）**

`CitationsCard.spec.ts` 第 31 行：

```ts
    expect(wrapper.find('.num').exists()).toBe(false)
```

（原 `'.font-mono'` 改为 `'.num'`。）

- [ ] **Step 2: 重写 CitationsCard.vue**

完整替换为：

```vue
<script setup lang="ts">
import { ref } from 'vue'
import { Paperclip, ArrowDown, ArrowUp } from '@element-plus/icons-vue'
import type { Citation } from '../types/chat'

defineProps<{ citations: Citation[] }>()
const expanded = ref(false)
</script>

<template>
  <div v-if="citations.length" class="mt-2">
    <button
      data-testid="citations-toggle"
      type="button"
      :aria-expanded="expanded"
      class="inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs transition-colors"
      :style="{
        backgroundColor: expanded ? 'var(--accent-soft)' : 'var(--surface-secondary)',
        color: 'var(--foreground)',
        borderColor: 'var(--border)',
      }"
      @click="expanded = !expanded"
    >
      <el-icon :size="12"><Paperclip /></el-icon>
      <span>{{ citations.length }} 条来源</span>
      <el-icon :size="12"><ArrowUp v-if="expanded" /><ArrowDown v-else /></el-icon>
    </button>

    <ol v-if="expanded" class="mt-2 space-y-1.5">
      <li
        v-for="(c, i) in citations"
        :key="i"
        class="citation-item rounded-md border px-2.5 py-1.5 text-xs"
        :style="{ backgroundColor: 'var(--surface-secondary)', borderColor: 'var(--border)' }"
      >
        <div class="flex items-center justify-between gap-2" :style="{ color: 'var(--foreground)' }">
          <span class="font-medium">{{ i + 1 }}. {{ c.documentName }}<span v-if="c.page"> · p{{ c.page }}</span></span>
          <span v-if="c.score != null" class="num text-[10px] opacity-60">{{ c.score.toFixed(2) }}</span>
        </div>
        <p v-if="c.snippet" class="mt-0.5 line-clamp-2 opacity-70" :style="{ color: 'var(--foreground)' }">{{ c.snippet }}</p>
      </li>
    </ol>
  </div>
</template>

<style scoped>
.citation-item {
  transition: background-color var(--dur-fast) ease;
}
.citation-item:hover {
  background-color: var(--accent-soft);
}
</style>
```

- [ ] **Step 3: 跑测试**

Run: `pnpm --filter web test:run -- src/modules/chat/__tests__/CitationsCard.spec.ts`
Expected: 4 个用例全部 PASS（`2 条来源` 文案、`aria-expanded` 切换、空引用不渲染、无 score 时无 `.num`）。

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/modules/chat/components/CitationsCard.vue apps/web/src/modules/chat/__tests__/CitationsCard.spec.ts
git commit -m "refactor(chat): CitationsCard 图标化(Paperclip/Arrow)与 .num 统一、hover 态"
```

---

### Task 3: ChatMessage — 用户气泡 token 化 / 助手平铺 / 操作行图标化 / prose-chat 增强

**Files:**
- Modify: `apps/web/src/modules/chat/components/ChatMessage.vue`
- Test: `apps/web/src/modules/chat/__tests__/ChatMessage.spec.ts`（不改，须全部通过）

- [ ] **Step 1: 重写 ChatMessage.vue**

完整替换为：

```vue
<script setup lang="ts">
import { computed } from 'vue'
import { useClipboard } from '@vueuse/core'
import { CopyDocument } from '@element-plus/icons-vue'
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
const showTokens = computed(() => props.message.totalTokens != null && props.message.promptTokens != null && props.message.completionTokens != null)
const { copy, copied } = useClipboard()

function onCopy() {
  // copy 返回 Promise；吞掉拒绝避免未处理 rejection（如剪贴板权限被拒）
  copy(props.message.content).catch(() => {})
}
function onFeedback(action: 'like' | 'dislike') {
  if (props.message.id) emit('feedback', props.message.id, action)
}
</script>

<template>
  <div class="flex py-1.5" :class="isUser ? 'justify-end' : ''">
    <!-- 用户消息：accent 气泡（accent-foreground 修复深色 uber 白底白字） -->
    <div
      v-if="isUser"
      class="max-w-[75%] whitespace-pre-wrap rounded-2xl rounded-br-md px-4 py-2 text-sm leading-relaxed"
      :style="{ backgroundColor: 'var(--accent)', color: 'var(--accent-foreground)' }"
    >{{ message.content }}</div>

    <!-- 助手消息：平铺无气泡 -->
    <div v-else class="w-full min-w-0">
      <div class="text-sm leading-relaxed" :style="{ color: 'var(--foreground)' }">
        <div class="prose-chat" v-html="html" />
        <span
          v-if="showCursor"
          data-testid="stream-cursor"
          class="ml-0.5 inline-block w-[2px] h-[1em] align-middle animate-pulse"
          :style="{ backgroundColor: 'var(--accent)' }"
        />
      </div>

      <CitationsCard v-if="message.citations?.length" :citations="message.citations ?? []" />

      <!-- 页脚：反馈 / 复制 / token（仅 done） -->
      <div
        v-if="!message.streaming"
        class="mt-2 flex items-center gap-3 text-xs"
        :style="{ color: 'var(--foreground)' }"
      >
        <button
          data-testid="feedback-like"
          aria-label="赞"
          class="opacity-40 transition-opacity hover:opacity-100"
          :class="message.feedback === 'like' ? 'opacity-100' : ''"
          :style="message.feedback === 'like' ? { color: 'var(--accent)' } : {}"
          @click="onFeedback('like')"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="h-3.5 w-3.5"><path d="M7 10v12" /><path d="M15 5.88 14 10h5.83a2 2 0 0 1 1.92 2.56l-2.33 8A2 2 0 0 1 17.5 22H4a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2h2.76a2 2 0 0 0 1.79-1.11L12 2a3.13 3.13 0 0 1 3 3.88Z" /></svg>
        </button>
        <button
          data-testid="feedback-dislike"
          aria-label="踩"
          class="opacity-40 transition-opacity hover:opacity-100"
          :class="message.feedback === 'dislike' ? 'opacity-100' : ''"
          :style="message.feedback === 'dislike' ? { color: 'var(--accent)' } : {}"
          @click="onFeedback('dislike')"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="h-3.5 w-3.5 rotate-180"><path d="M7 10v12" /><path d="M15 5.88 14 10h5.83a2 2 0 0 1 1.92 2.56l-2.33 8A2 2 0 0 1 17.5 22H4a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2h2.76a2 2 0 0 0 1.79-1.11L12 2a3.13 3.13 0 0 1 3 3.88Z" /></svg>
        </button>
        <button
          aria-label="复制"
          class="flex items-center gap-1 opacity-40 transition-opacity hover:opacity-100"
          @click="onCopy"
        >
          <el-icon :size="13"><CopyDocument /></el-icon>
          <span>{{ copied ? '已复制' : '复制' }}</span>
        </button>
        <span v-if="showTokens" class="num opacity-50">
          {{ message.promptTokens }}/{{ message.completionTokens }}/{{ message.totalTokens }}
        </span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.prose-chat :deep(h1),
.prose-chat :deep(h2),
.prose-chat :deep(h3) {
  font-family: var(--font-display);
  font-weight: 600;
  letter-spacing: -0.01em;
  margin: 0.8rem 0 0.4rem;
}
.prose-chat :deep(h1) { font-size: 1.15rem; }
.prose-chat :deep(h2) { font-size: 1.05rem; }
.prose-chat :deep(h3) { font-size: 0.95rem; }
.prose-chat :deep(p) { margin: 0.4rem 0; }
.prose-chat :deep(ul), .prose-chat :deep(ol) { margin: 0.4rem 0; padding-left: 1.25rem; }
.prose-chat :deep(a) { color: var(--accent); text-decoration: underline; }
.prose-chat :deep(code) {
  font-family: var(--font-mono, monospace);
  background-color: var(--surface-secondary);
  padding: 0.1rem 0.3rem;
  border-radius: 0.25rem;
}
.prose-chat :deep(pre) {
  background-color: var(--surface-secondary);
  border: 1px solid var(--border);
  padding: 0.75rem;
  border-radius: 0.5rem;
  overflow-x: auto;
}
.prose-chat :deep(pre code) { background: transparent; padding: 0; }
.prose-chat :deep(blockquote) {
  margin: 0.5rem 0;
  padding: 0.25rem 0.75rem;
  border-left: 3px solid var(--accent);
  background: var(--accent-soft);
  border-radius: 0 0.375rem 0.375rem 0;
}
.prose-chat :deep(table) { border-collapse: collapse; margin: 0.5rem 0; width: 100%; }
.prose-chat :deep(th), .prose-chat :deep(td) {
  border: 1px solid var(--border);
  padding: 0.3rem 0.6rem;
  text-align: left;
}
.prose-chat :deep(tbody tr:nth-child(odd)) { background: var(--surface-secondary); }
.prose-chat :deep(hr) { border: 0; border-top: 1px solid var(--border); margin: 0.8rem 0; }
</style>
```

注意：like/dislike SVG 为内联 thumb 图标（EP 图标库无 thumb），dislike 通过 `rotate-180` 复用同一路径。

- [ ] **Step 2: 跑测试**

Run: `pnpm --filter web test:run -- src/modules/chat/__tests__/ChatMessage.spec.ts`
Expected: 10 个用例全部 PASS（markdown 渲染、用户纯文本转义、stream-cursor、feedback 事件、引用卡、`1/2/3` token、XSS、链接新标签）。

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/modules/chat/components/ChatMessage.vue
git commit -m "refactor(chat): ChatMessage 视觉重构——助手平铺/用户气泡 accent-foreground/操作行图标化/prose-chat 增强"
```

---

### Task 4: ChatEmptyState — 品牌 hero + 2×2 建议卡（props 变更，TDD）

**Files:**
- Create: `apps/web/src/modules/chat/components/suggestions.ts`
- Modify: `apps/web/src/modules/chat/components/ChatEmptyState.vue`
- Create: `apps/web/src/modules/chat/__tests__/ChatEmptyState.spec.ts`

- [ ] **Step 1: 先写失败测试**

创建 `apps/web/src/modules/chat/__tests__/ChatEmptyState.spec.ts`：

```ts
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import ChatEmptyState from '../components/ChatEmptyState.vue'

describe('ChatEmptyState', () => {
  it('renders title and default suggestions', () => {
    const wrapper = mount(ChatEmptyState)
    expect(wrapper.text()).toContain('开始对话')
    expect(wrapper.text()).toContain('知识库问答')
    expect(wrapper.text()).toContain('起草文档')
  })

  it('emits suggest with suggestion text on card click', async () => {
    const wrapper = mount(ChatEmptyState, { props: { title: '开始一个新的对话' } })
    await wrapper.find('button').trigger('click')
    expect(wrapper.emitted('suggest')?.[0]).toEqual(['这个知识库包含哪些文档？'])
  })
})
```

- [ ] **Step 2: 跑测试确认失败**

Run: `pnpm --filter web test:run -- src/modules/chat/__tests__/ChatEmptyState.spec.ts`
Expected: FAIL（当前组件渲染的是旧 chips，无「知识库问答」文案）。

- [ ] **Step 3: 创建 suggestions.ts**

创建 `apps/web/src/modules/chat/components/suggestions.ts`：

```ts
import type { Component } from 'vue'
import { Search, Document, QuestionFilled, EditPen } from '@element-plus/icons-vue'

export interface ChatSuggestion {
  icon: Component
  title: string
  text: string
}

export const DEFAULT_SUGGESTIONS: ChatSuggestion[] = [
  { icon: Search, title: '知识库问答', text: '这个知识库包含哪些文档？' },
  { icon: Document, title: '内容总结', text: '请帮我总结最新的规定' },
  { icon: QuestionFilled, title: '常见问题', text: '大家最常问的问题有哪些？' },
  { icon: EditPen, title: '起草文档', text: '帮我起草一份季度总结' },
]
```

- [ ] **Step 4: 重写 ChatEmptyState.vue**

完整替换为：

```vue
<script setup lang="ts">
import { ChatLineSquare } from '@element-plus/icons-vue'
import { DEFAULT_SUGGESTIONS, type ChatSuggestion } from './suggestions'

const props = defineProps<{
  title?: string
  subtitle?: string
  suggestions?: ChatSuggestion[]
}>()
const emit = defineEmits<{ (e: 'suggest', text: string): void }>()

const list = props.suggestions?.length ? props.suggestions : DEFAULT_SUGGESTIONS
</script>

<template>
  <div class="mx-auto flex min-h-[320px] w-full max-w-[760px] flex-col items-center justify-center gap-3 px-6 text-center">
    <div
      class="rise-in flex h-11 w-11 items-center justify-center rounded-xl"
      style="background: var(--brand-gradient); box-shadow: 0 8px 20px -8px color-mix(in oklch, var(--accent) 55%, transparent)"
    >
      <el-icon :size="20" color="var(--accent-foreground)"><ChatLineSquare /></el-icon>
    </div>
    <h2
      class="rise-in font-display text-xl font-bold tracking-tight"
      style="color: var(--foreground); animation-delay: 60ms"
    >
      {{ title ?? '开始对话' }}
    </h2>
    <p
      class="rise-in text-sm"
      style="color: var(--foreground); opacity: 0.55; animation-delay: 120ms"
    >
      {{ subtitle ?? '基于企业知识库的智能问答，支持引用溯源' }}
    </p>
    <div class="mt-2 grid w-full max-w-[520px] grid-cols-1 gap-2 sm:grid-cols-2">
      <button
        v-for="(s, i) in list"
        :key="s.title"
        type="button"
        class="suggest-card rise-in flex flex-col gap-1 rounded-lg border px-3.5 py-3 text-left"
        :style="{
          borderColor: 'var(--border)',
          backgroundColor: 'var(--surface)',
          animationDelay: `${180 + i * 60}ms`,
        }"
        @click="emit('suggest', s.text)"
      >
        <span class="flex items-center gap-2 text-sm font-medium" style="color: var(--foreground)">
          <span
            class="flex h-6 w-6 items-center justify-center rounded-md"
            style="background: var(--accent-soft); color: var(--accent)"
          >
            <el-icon :size="14"><component :is="s.icon" /></el-icon>
          </span>
          {{ s.title }}
        </span>
        <span class="text-xs" style="color: var(--foreground); opacity: 0.55">{{ s.text }}</span>
      </button>
    </div>
  </div>
</template>

<style scoped>
.suggest-card {
  transition:
    transform var(--dur-base) var(--ease-out),
    box-shadow var(--dur-base) var(--ease-out),
    border-color var(--dur-base) ease;
}
.suggest-card:hover {
  transform: translateY(-2px);
  border-color: color-mix(in oklch, var(--accent) 32%, var(--border));
  box-shadow: 0 12px 16px -12px var(--accent-glow);
}
</style>
```

- [ ] **Step 5: 跑测试确认通过**

Run: `pnpm --filter web test:run -- src/modules/chat/__tests__/ChatEmptyState.spec.ts`
Expected: 2 个用例 PASS。

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/modules/chat/components/suggestions.ts apps/web/src/modules/chat/components/ChatEmptyState.vue apps/web/src/modules/chat/__tests__/ChatEmptyState.spec.ts
git commit -m "feat(chat): ChatEmptyState 重构——品牌 hero + 2×2 建议卡 + rise-in 交错入场"
```

注意：此任务后 `ChatList.vue` / `ChatSession.vue` 的旧调用（传 `string[]` suggestions）类型已不兼容，由 Task 8/9 更新；期间 `check-types` 会报错属预期。

---

### Task 5: ChatSessionList — 侧栏底色 + hover/active 态

**Files:**
- Modify: `apps/web/src/modules/chat/components/ChatSessionList.vue`

- [ ] **Step 1: 修改模板与样式**

`aside` 根节点加底色：

```vue
  <aside class="flex h-full w-[260px] flex-col border-r" :style="{ borderColor: 'var(--border)', backgroundColor: 'var(--surface-secondary)' }">
```

会话项 `li` 改为 class 驱动（替换原 `:style` 绑定）：

```vue
        <li
          v-for="s in sessions"
          :key="s.id"
          class="session-item group cursor-pointer rounded-lg px-3 py-2"
          :class="s.id === activeId ? 'active' : ''"
          @click="emit('select', s.id)"
        >
```

`<style scoped>` 追加：

```css
.session-item {
  transition: background-color var(--dur-fast) ease;
}
.session-item:hover {
  background-color: color-mix(in oklch, var(--accent) 5%, transparent);
}
.session-item.active {
  background-color: var(--accent-soft);
  box-shadow: inset 2px 0 0 var(--accent);
}
```

- [ ] **Step 2: 类型检查 + 跑 chat 测试**

Run: `pnpm --filter web check-types && pnpm --filter web test:run -- src/modules/chat`
Expected: 无本文件相关错误（ChatList/ChatSession 的 EmptyState 类型错误此时仍存在，属预期）；无针对本组件的 spec，其余用例不受影响。

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/modules/chat/components/ChatSessionList.vue
git commit -m "refactor(chat): 会话列表侧栏底色 + hover/active 指示条"
```

---

### Task 6: ChatStreamStatus — 胶囊样式升级

**Files:**
- Modify: `apps/web/src/modules/chat/components/ChatStreamStatus.vue`

- [ ] **Step 1: 替换模板根节点**

将根 `div` 替换为（`rounded-lg` → `rounded-full` 胶囊 + `rise-in` 入场，其余逻辑不变）：

```vue
  <div
    v-if="visible"
    class="rise-in inline-flex items-center gap-2 self-start rounded-full px-3 py-1.5 text-xs"
    :style="{ backgroundColor: 'var(--accent-soft)', color: 'var(--accent)' }"
  >
```

（script 部分与内部 spinner/label 不变。）

- [ ] **Step 2: 跑 chat 测试**

Run: `pnpm --filter web test:run -- src/modules/chat`
Expected: 无回归（无针对该组件的断言）。

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/modules/chat/components/ChatStreamStatus.vue
git commit -m "refactor(chat): ChatStreamStatus 胶囊化 + rise-in 入场"
```

---

### Task 7: ChatInput — 居中限宽 / 圆角 / focus 发光 / 按钮对比度

**Files:**
- Modify: `apps/web/src/modules/chat/components/ChatInput.vue`
- Test: `apps/web/src/modules/chat/__tests__/ChatInput.spec.ts`（不改，须全部通过）

- [ ] **Step 1: 替换模板**

template 部分完整替换为（script 不变）：

```vue
<template>
  <div
    class="border-t p-3"
    :style="{ borderColor: 'var(--border)', backgroundColor: 'var(--surface)' }"
  >
    <div class="mx-auto flex w-full max-w-[760px] items-end gap-2">
      <textarea
        ref="textareaRef"
        v-model="content"
        rows="1"
        placeholder="输入问题，Enter 发送，Shift+Enter 换行"
        class="chat-textarea flex-1 resize-none rounded-xl px-3 py-2 text-sm outline-none"
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
        aria-label="发送"
        class="flex h-9 w-9 items-center justify-center rounded-lg transition-opacity disabled:opacity-40"
        :style="{ backgroundColor: 'var(--accent)', color: 'var(--accent-foreground)' }"
        :disabled="!content.trim()"
        @click="submit"
      >
        <el-icon :size="16"><Promotion /></el-icon>
      </button>
      <button
        v-else
        data-testid="stop-btn"
        aria-label="停止"
        class="flex h-9 w-9 items-center justify-center rounded-lg"
        :style="{ backgroundColor: 'var(--accent-soft)', color: 'var(--accent)' }"
        @click="emit('stop')"
      >
        <el-icon :size="16"><VideoPause /></el-icon>
      </button>
    </div>
  </div>
</template>

<style scoped>
.chat-textarea {
  transition:
    box-shadow var(--dur-fast) ease,
    border-color var(--dur-fast) ease;
}
.chat-textarea:focus {
  border-color: color-mix(in oklch, var(--accent) 32%, var(--border));
  box-shadow: 0 0 0 3px var(--accent-soft);
}
</style>
```

要点：发送按钮从 `text-white` 类改为 `color: var(--accent-foreground)`（修复深色 uber 对比度）；输入列与消息列同宽居中（`max-w-[760px]`）。

- [ ] **Step 2: 跑测试**

Run: `pnpm --filter web test:run -- src/modules/chat/__tests__/ChatInput.spec.ts`
Expected: 3 个用例全部 PASS。

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/modules/chat/components/ChatInput.vue
git commit -m "refactor(chat): ChatInput 居中限宽 + focus 发光 + 发送按钮 accent-foreground 对比度修复"
```

---

### Task 8: ChatSession 视图 — 浮岛卡片 / 标题页头 / 居中单栏 / 语义化错误横幅 / 滚动按钮图标化

**Files:**
- Modify: `apps/web/src/modules/chat/views/ChatSession.vue`

- [ ] **Step 1: 重写 ChatSession.vue**

完整替换为：

```vue
<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import dayjs from 'dayjs'
import relativeTime from 'dayjs/plugin/relativeTime'
import { Bottom, ChatLineSquare, WarningFilled } from '@element-plus/icons-vue'
import { useChatSessions, useChatStream } from '../composables/useChat'
import ChatSessionList from '../components/ChatSessionList.vue'
import ChatMessage from '../components/ChatMessage.vue'
import ChatInput from '../components/ChatInput.vue'
import ChatStreamStatus from '../components/ChatStreamStatus.vue'
import ChatEmptyState from '../components/ChatEmptyState.vue'

dayjs.extend(relativeTime)

const route = useRoute()
const router = useRouter()

// 用 ref + watch 跟随路由（/chat/new → createSession 后 router.replace 切到真 id），
// 保证 useChatStream 内部 toValue(sessionId) 在 done 失效时命中正确 query key
const sessionId = ref(String(route.params.sessionId ?? ''))
watch(() => route.params.sessionId, (v) => { sessionId.value = String(v ?? '') })
const { messages, phase, isStreaming, error, send, stop, sendFeedback } = useChatStream(sessionId)

const { data: sessionsData } = useChatSessions()
const currentSession = computed(() => (sessionsData.value ?? []).find((s) => s.id === sessionId.value))
const headerTitle = computed(() =>
  sessionId.value === 'new' ? '新会话' : (currentSession.value?.title ?? '对话'),
)
const headerMeta = computed(() => {
  const parts: string[] = []
  if (messages.value.length) parts.push(`${messages.value.length} 条消息`)
  if (currentSession.value?.createdAt) parts.push(dayjs(currentSession.value.createdAt).fromNow())
  return parts.join(' · ')
})

const threadRef = ref<HTMLElement | null>(null)
const showScrollBtn = ref(false)
const isNearBottom = ref(true)

const isEmpty = computed(() => !isStreaming.value && messages.value.length === 0)

async function scrollToBottom() {
  await nextTick()
  const el = threadRef.value
  // 仅当用户贴底时自动滚动；用户上滑查阅时不打断（避免流式增量把视图拽回底部）
  if (el && isNearBottom.value) el.scrollTop = el.scrollHeight
}

// 用户点击「回到底部」浮动按钮：强制滚动并恢复贴底状态。
// scrollToBottom 的 isNearBottom 守卫会让按钮点击变成 no-op——按钮只在 isNearBottom=false 时渲染，
// 直接复用 scrollToBottom 会因守卫失败而不滚动（最终评审发现的 Important 回归）。
async function backToBottom() {
  isNearBottom.value = true
  showScrollBtn.value = false
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
  const near = el.scrollTop + el.clientHeight >= el.scrollHeight - 80
  isNearBottom.value = near
  showScrollBtn.value = !near
}

function onSelect(id: string) { router.push(`/chat/${id}`) }
function onNew() { router.push('/chat/new') }
function onSuggest(text: string) { send(text) }
function onFeedback(messageId: string, action: 'like' | 'dislike') { sendFeedback(messageId, action) }
</script>

<template>
  <div
    class="chat-island flex h-full min-h-[480px] overflow-hidden rounded-xl border"
    :style="{ borderColor: 'var(--border)', backgroundColor: 'var(--surface)' }"
  >
    <ChatSessionList :active-id="sessionId" @select="onSelect" @new="onNew" />

    <section class="relative flex min-w-0 flex-1 flex-col">
      <header
        class="flex items-center justify-between gap-3 border-b px-4 py-3"
        :style="{ borderColor: 'var(--border)' }"
      >
        <div class="flex min-w-0 items-center gap-2.5">
          <span
            class="flex h-6 w-6 shrink-0 items-center justify-center rounded-md"
            style="background: var(--brand-gradient)"
          >
            <el-icon :size="13" color="var(--accent-foreground)"><ChatLineSquare /></el-icon>
          </span>
          <span class="truncate text-sm font-semibold" :style="{ color: 'var(--foreground)' }">
            {{ headerTitle }}
          </span>
        </div>
        <span
          v-if="headerMeta"
          class="num shrink-0 text-[11px]"
          :style="{ color: 'var(--foreground)', opacity: 0.5 }"
        >{{ headerMeta }}</span>
      </header>

      <div ref="threadRef" class="relative flex-1 overflow-y-auto px-4 py-4" @scroll="onScroll">
        <div class="mx-auto w-full max-w-[760px]">
          <div
            v-if="error"
            class="my-2 flex items-center gap-2 rounded-lg px-3 py-2 text-sm"
            :style="{ backgroundColor: 'var(--el-color-error-light-9)', color: 'var(--el-color-error)' }"
          >
            <el-icon :size="14"><WarningFilled /></el-icon>
            <span class="min-w-0 flex-1">{{ error }}</span>
            <el-button
              v-if="messages.length >= 2"
              size="small"
              text
              type="danger"
              @click="send(messages[messages.length-2]?.content ?? '')"
            >重试</el-button>
          </div>

          <ChatEmptyState v-if="isEmpty" @suggest="onSuggest" />

          <template v-else>
            <ChatStreamStatus :phase="phase" />
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
      </div>

      <button
        v-if="showScrollBtn"
        class="absolute bottom-24 right-6 flex items-center gap-1 rounded-full border px-3 py-1 text-xs shadow"
        :style="{ borderColor: 'var(--border)', backgroundColor: 'var(--surface)', color: 'var(--foreground)' }"
        @click="backToBottom"
      >
        <el-icon :size="12"><Bottom /></el-icon>回到底部
      </button>

      <ChatInput :streaming="isStreaming" @send="send" @stop="stop" />
    </section>
  </div>
</template>

<style scoped>
.msg-enter-active { transition: opacity var(--dur-base) var(--ease-out), transform var(--dur-base) var(--ease-out); }
.msg-enter-from { opacity: 0; transform: translateY(6px); }
</style>
```

要点：根节点从 `flex h-full -m-6` 改为浮岛卡片（MainLayout padding 保留，露出网格背景）；header 显示会话标题 + `.num` meta；消息/错误/空状态全部包进 `max-w-[760px]` 居中单栏；错误横幅用 `--el-color-error` 语义色。

- [ ] **Step 2: 类型检查 + 全量 chat 测试**

Run: `pnpm --filter web check-types && pnpm --filter web test:run -- src/modules/chat`
Expected: check-types 仅剩 ChatList.vue 一处 EmptyState 类型错误（Task 9 修复）；测试全部 PASS。

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/modules/chat/views/ChatSession.vue
git commit -m "refactor(chat): ChatSession 浮岛卡片布局 + 会话标题页头 + 居中单栏 + 语义化错误横幅"
```

---

### Task 9: ChatList 视图 — 浮岛卡片 + 欢迎页

**Files:**
- Modify: `apps/web/src/modules/chat/views/ChatList.vue`

- [ ] **Step 1: 重写 ChatList.vue**

完整替换为：

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
  <div
    class="chat-island flex h-full min-h-[480px] overflow-hidden rounded-xl border"
    :style="{ borderColor: 'var(--border)', backgroundColor: 'var(--surface)' }"
  >
    <ChatSessionList @select="onSelect" @new="onNew" />
    <section class="flex min-w-0 flex-1 items-center justify-center">
      <ChatEmptyState title="开始一个新的对话" @suggest="onSuggest" />
    </section>
  </div>
</template>
```

要点：不再传 `string[]` suggestions（新版组件用默认 4 条建议卡）；建议点击行为保持现状（跳 `/chat/new`）。

- [ ] **Step 2: 类型检查 + 全量 chat 测试 + lint**

Run: `pnpm --filter web check-types && pnpm --filter web test:run -- src/modules/chat && pnpm --filter web lint`
Expected: 全部通过，无类型错误残留。

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/modules/chat/views/ChatList.vue
git commit -m "refactor(chat): ChatList 欢迎页——浮岛卡片 + 品牌 hero 空状态"
```

---

### Task 10: 终验 — 全量测试 + 构建 + 走查清单

**Files:** 无新增改动（如有问题回到对应 Task 修复）

- [ ] **Step 1: 全量测试**

Run: `pnpm --filter web test:run`
Expected: 全部 PASS（chat 8 个 spec 文件，含新增 ChatEmptyState.spec.ts）。

- [ ] **Step 2: 构建**

Run: `pnpm --filter web build`
Expected: 构建成功。

- [ ] **Step 3: 手动走查（启动 dev 与 mock 流）**

```bash
cd apps/web && VITE_CHAT_MOCK=1 pnpm dev
```

走查清单（3 主题 uber/coinbase/rabbit × 明暗 各过一遍）：
- /chat 欢迎页：hero + 2×2 建议卡、rise-in 交错入场、建议卡 hover 浮起
- /chat/new：空状态同上；点击建议卡直接发起提问
- 会话页：页头显示会话标题 + 消息数/相对时间；用户气泡文字在深色 uber 下可读（黑字白底）；发送按钮在深色 uber 下为白底深色图标
- 消息列与输入框同宽居中；助手消息平铺；操作行 thumb/copy 图标；token 为等宽数字
- 引用卡：Paperclip 图标、展开箭头切换、列表项 hover
- 流式状态胶囊 + spinner；错误横幅为错误色 + WarningFilled + 重试按钮
- 「回到底部」按钮带 Bottom 图标
- 浮岛卡片外露出 nexus-main 网格背景，无 -m-6 边缘错位

- [ ] **Step 4: 如有未提交改动则提交，确认工作区干净**

Run: `git status`
Expected: clean（或仅有意保留的改动）。
