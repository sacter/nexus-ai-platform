# Chat 模块展示优化设计

**日期**: 2026-08-18
**状态**: 已确认
**范围**: `apps/web/src/modules/chat/**` + `apps/web/src/styles/globals.css`（仅新增 token）+ 模块内测试同步

---

## 一、概述

### 1.1 背景

chat 前端已合入 main（a4c5e0a），但展示层与全站视觉语言（渐变图标页头、`el-card` 卡片、`.num` 等宽数字、`rise-in` 入场、EP 图标、三主题 token 体系）存在明显差距，且存在真实显示 bug。

### 1.2 现状问题

| 类别 | 问题 |
|------|------|
| Bug | 深色 uber 主题 `--accent` 为白色，用户气泡 / AI 头像 / 发送按钮硬编码 `color:'#fff'` → 白底白字不可读 |
| Bug | 视图根节点 `-m-6` 与 MainLayout 实际 padding（`py-5 px-4` = 20/16px）不匹配，四边分别多伸出 4/8px，边缘错位 |
| 规范 | 两页无页头，ChatList 为单薄占位页，与 Dashboard/KnowledgeList 页头语言脱节 |
| 规范 | 👍👎📎 / ▾▴ / ↓ 等 emoji 与字符充当图标（全站惯例为 EP 图标） |
| 规范 | token 数使用 `font-mono` 而非全站 `.num` class |
| 规范 | 错误横幅红字 + `--accent-soft` 底，未使用语义化错误色 |
| 体验 | 消息列无最大宽度约束，宽屏下气泡/段落行长过长 |
| 体验 | 会话列表项无 hover 态；空状态单薄 |
| 体验 | prose-chat 仅有 code/pre/p/ul/a 基础样式，缺标题/引用/表格/hr |

### 1.3 目标（已与用户确认的三个形态决策）

1. **浮岛单卡片**：MainLayout 保留 padding 露出网格背景，chat 整体为一张圆角浮起卡片，列表与对话区在其中以细线分隔
2. **居中单栏**：卡片内消息列与输入框限宽（约 760px）居中
3. **品牌 hero 空状态**：ChatList 欢迎页与新会话空状态统一为「渐变图标 + display 大标题 + 2×2 建议卡片」

范围限定：**视觉升级 + 轻度重排**，不做交互结构重做。

### 1.4 明确不做（YAGNI）

- 会话重命名 / 删除等会话管理操作
- 消息操作菜单（悬停浮出等）
- 引用面板重做（保持现有折叠卡交互）
- 历史消息 enrichment / 重试逻辑 / sendFeedback 字段对齐（已记为独立 follow-up）
- MainLayout / router 改动

---

## 二、设计

### 2.1 布局骨架

- 移除 `-m-6`。`ChatList.vue` / `ChatSession.vue` 根节点改为：

  ```
  flex h-full min-h-[480px] overflow-hidden rounded-xl border border-border bg-surface
  ```

  外加 accent-glow 微阴影（对齐 `.el-card.is-always-shadow` 的 `0 12px 16px -12px var(--accent-glow)`）。
- 卡片内左侧 260px 会话侧栏：背景 `--surface-secondary`，右侧 `1px var(--border)` 分隔。
- 视口过矮时卡片内部区域各自滚动（消息区 `overflow-y-auto`），主区不出现整页滚动条（`min-h-[480px]` 之外仍允许 MainLayout 滚动兜底）。

### 2.2 会话列表（ChatSessionList.vue）

- 新增 hover 态：`background: var(--accent-soft)` 的 50% 混合，过渡 `--dur-fast`。
- active 态：`accent-soft` 底 + 左侧 2px accent 指示条（`box-shadow: inset 2px 0 0 var(--accent)`）。
- 「新会话」按钮保持 `el-button type="primary"` 全宽。
- 骨架屏、`el-empty` 保持。

### 2.3 页头

**会话页 header**（卡片内、对话区顶部）：

- 左：16px 渐变图标瓦片（`--brand-gradient` + accent-glow 阴影，`rounded-md`）+ 当前会话标题（从 `useChatSessions` 数据按 `sessionId` 匹配 `title`；`/chat/new` 显示「新会话」；无匹配回退「对话」），`text-sm font-semibold`。
- 右：`.num` 等宽小字 `N 条消息 · 相对时间`（消息数为当前 `messages.length`；时间取会话 `createdAt` 经 dayjs fromNow，缺省不渲染该项）。

**欢迎页 hero**（ChatList，居中单栏内垂直居中）：

- 40px 渐变图标瓦片（`rounded-xl`、accent-glow 阴影，内嵌 EP `ChatLineSquare` 白色图标）。
- `font-display text-xl font-bold tracking-tight` 大标题 + `opacity-55` 副标题「基于企业知识库的智能问答，支持引用溯源」。
- 2×2 建议卡片网格（详见 2.6）。

### 2.4 消息区（ChatSession.vue + ChatMessage.vue）

- 消息列容器：`mx-auto w-full max-w-[760px] px-4`，流式状态、消息、错误横幅全部对齐此栏宽。
- **用户消息**：accent 气泡靠右（`rounded-2xl rounded-br-md`，`max-w-[75%]`），背景 `var(--accent)`，文字色用新 token `--accent-foreground`（见 2.7）。
- **助手消息**：平铺无气泡、无头像。markdown 直接排入栏内（`text-sm leading-relaxed`，色 `--foreground`）。
- 流式光标保留（`data-testid="stream-cursor"`），色 `--accent`。
- **操作行**（助手消息且非流式时）：
  - like/dislike：内联 SVG thumb 图标（outline，lucide `thumbs-up` path，dislike 旋转 180°），`size-3.5`，未选中 `--foreground` 40% 透明度，选中 `--accent` 100%；保留 `data-testid="feedback-like" / "feedback-dislike"`。
  - 复制：EP `CopyDocument` 图标 + 「复制 / 已复制」文案。
  - token 数：`.num` class + 50% 透明度，格式 `prompt/completion/total`。
- **错误横幅**：背景 `var(--el-color-error-light-9)`、文字 `var(--el-color-error)`、EP `WarningFilled` 图标、`rounded-lg`；「重试」改为 `el-button size="small"` 文本型，条件（`messages.length >= 2`）不变。
- **流式状态**（ChatStreamStatus.vue）：保持组件与显隐逻辑，样式升级为栏内左对齐的 `accent-soft` 胶囊：spinner + 阶段标签，进入时 `rise-in`。

### 2.5 引用卡（CitationsCard.vue）

- 📎 → EP `Paperclip` 图标；▾/▴ → EP `ArrowDown` / `ArrowUp` 图标切换。
- 保留 `data-testid="citations-toggle"` 与折叠交互。
- 列表项 hover 加深底色；score 用 `.num`。

### 2.6 空状态（ChatEmptyState.vue）

- props 扩展：`suggestions` 由 `string[]` 扩展为 `Array<{ icon: string; title: string; text: string }>`（`icon` 为 EP 图标组件名映射键）。为兼容现有调用，保留 `title?: string`，移除 `string[]` 用法（仅 ChatList / ChatSession 两处调用，一并更新）。
- 结构（居中单栏内垂直居中）：hero 渐变图标 → 大标题 → 副标题 → 2×2 建议卡网格（移动端 1 列）。
- 建议卡：`rounded-lg border border-border bg-surface`，图标（accent-soft 底）+ 标题 `text-sm font-medium` + 示例问题 `text-xs opacity-55`；hover 时 accent 描边 + 微浮起（对齐 `.el-card` hover 语言）。
- 入场：各元素 `.rise-in` + `animation-delay` 60ms 步进（对齐 Dashboard stagger）。
- 默认建议（ChatSession 空状态与 ChatList 共用 4 条）：知识库问答（`Search`）、内容总结（`Document`）、常见问题（`QuestionFilled`）、起草文档（`EditPen`）。
- ChatList 页：卡片主区内直接渲染上述空状态组件，`title="开始一个新的对话"`；建议点击行为保持现状（跳 `/chat/new`）。

### 2.7 主题适配（globals.css）

新增 token，6 组主题分别定义：

```css
/* uber 浅色 */    --accent-foreground: oklch(100% 0 0);
/* uber 深色 */    --accent-foreground: oklch(21.03% 0 0);
/* coinbase 浅色 */ --accent-foreground: oklch(100% 0 0);
/* coinbase 深色 */ --accent-foreground: oklch(100% 0 0);
/* rabbit 浅色 */   --accent-foreground: oklch(100% 0 0);
/* rabbit 深色 */   --accent-foreground: oklch(100% 0 0);
```

`@theme` 注册 `--color-accent-foreground: var(--accent-foreground);` 以支持 `text-accent-foreground` 工具类。

所有 chat 模块内硬编码 `color:'#fff'` / `text-white`（用户气泡、发送按钮、回到底部按钮文字等）改用该 token；发送按钮在 dark uber（accent=白）下自动变为白底黑字。

### 2.8 输入区（ChatInput.vue）

- 输入框容器与消息列同宽居中（`max-w-[760px] mx-auto`）。
- textarea 圆角升级为 `rounded-xl`，focus 时 accent-soft 外发光（对齐全站 input 呼吸感）。
- 发送按钮：`bg-accent text-accent-foreground`（修复 dark uber 对比度）；停止按钮保持 `accent-soft` 底 + accent 字。
- 保留 `data-testid="stop-btn"` 与 Enter/Shift+Enter 逻辑。

### 2.9 其余打磨

- 「回到底部」按钮：↓ 字符 → EP `Bottom` 图标 + 文案，`num` 不需要；淡入 + 上移动效。
- prose-chat 补齐：`h1-h3` 层级（`font-display`）、`blockquote`（3px accent 左边条 + accent-soft 底）、`table`（细边框 + 斑马纹）、`hr`、代码块加 `1px var(--border)` 描边；链接保持 accent 色。
- 骨架/空态图标统一 EP 图标。

### 2.10 动效与无障碍

- 动效时长一律使用 `--dur-fast / --dur-base` + `--ease-out` token；`prefers-reduced-motion` 由全局规则覆盖，无需额外处理。
- like/dislike/复制按钮补 `aria-label`；滚动区保留现有 `aria` 语义。

---

## 三、测试

- 保留全部 5 个 `data-testid`（`stream-cursor` / `feedback-like` / `feedback-dislike` / `citations-toggle` / `stop-btn`），现有 8 个 spec 应全部通过；若断言依赖被移除的 emoji 文案（👍👎📎）或旧 class，同步更新断言。
- `ChatEmptyState` props 变更影响 `ChatList` / `ChatSession` 调用与 `smoke.spec.ts`，同步更新。
- 手动走查：3 主题 × 明暗 × （欢迎页 / 空会话 / 流式中 / 错误态 / 引用展开 / 宽屏与窄屏）。

## 四、文件改动清单

| 文件 | 改动 |
|------|------|
| `styles/globals.css` | 新增 `--accent-foreground` × 6 主题 + `@theme` 注册 |
| `chat/views/ChatSession.vue` | 根节点浮岛卡片化、header 标题化、消息列居中、错误横幅语义化、滚动按钮图标化 |
| `chat/views/ChatList.vue` | 浮岛卡片 + 欢迎页空状态 |
| `chat/components/ChatSessionList.vue` | hover/active 态、侧栏底色 |
| `chat/components/ChatMessage.vue` | 用户气泡 token 化、助手平铺、操作行图标化、`.num`、prose-chat 增强 |
| `chat/components/ChatInput.vue` | 居中限宽、圆角、focus 发光、按钮对比度修复 |
| `chat/components/ChatEmptyState.vue` | hero + 2×2 建议卡重构（props 变更） |
| `chat/components/ChatStreamStatus.vue` | 样式升级 |
| `chat/components/CitationsCard.vue` | 图标化、hover、`.num` |
| `chat/__tests__/*.spec.ts` | 受影响断言同步 |
