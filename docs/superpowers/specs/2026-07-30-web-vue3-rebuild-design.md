# Web 项目重构方案：Next.js → Vue 3

**日期**: 2026-07-30
**状态**: 已确认
**重构范围**: `apps/web` (Next.js 16 + HeroUI + React 19) → `apps/web-v2` (Vue 3 + Element Plus + Vite)

---

## 一、概述

### 1.1 背景

`apps/web` 当前基于 Next.js 16 App Router + HeroUI v3 + React 19 构建。本次重构将技术栈整体切换至 Vue 3 生态。

### 1.2 目标技术栈

| 类别 | 原技术 | 新技术 |
|------|--------|--------|
| 框架 | Next.js 16 (App Router) | Vue 3 + Vite 6 |
| 语言 | TypeScript 6 | TypeScript 6 |
| UI 库 | HeroUI v3 | Element Plus 2 |
| CSS | Tailwind CSS 4 | Tailwind CSS 4 |
| 状态管理 | React Context | Pinia 2 |
| 服务端状态 | @tanstack/react-query v5 | @tanstack/vue-query v5 |
| 路由 | Next.js App Router | Vue Router 4 |
| HTTP | Axios | Axios |
| 工具库 | - | VueUse |
| 图表 | - | ECharts (vue-echarts) |
| 工作流 | - | Vue Flow |
| 编辑器 | - | Monaco Editor |
| 校验 | Zod v4 + react-hook-form | Zod v4 |
| 图标 | Lucide React | @element-plus/icons-vue |

### 1.3 迁移策略

**全量重写、独立目录**：新建 `apps/web-v2`，从零搭建 Vue 3 项目，所有页面一次性重写后切换。旧 `apps/web` 保留作为功能参考，不做增量迁移。

### 1.4 UI 还原策略

**1:1 功能还原**：保持现有页面布局、交互逻辑、配色方案不变，纯技术栈迁移。Element Plus 组件替换 HeroUI 组件时尽量保持视觉一致。

---

## 二、平台级配置变更（nexus-ai-platform 根目录）

### 2.1 新增目录

```
apps/web-v2/          # 新 Vue3 项目
```

### 2.2 `turbo.json` — 更新 build outputs

```json
{
  "tasks": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**", ".next/**", ".vite/**"]
    }
  }
}
```

变更：`outputs` 增加 `.vite/**`（原只有 `dist/**` 和 `.next/**`），适配 Vite 构建缓存。

### 2.3 `docker/web.Dockerfile` — 重写

当前为空文件，重写为 Vite + Vue 3 的多阶段构建 Dockerfile：

```dockerfile
FROM node:22-alpine AS builder
WORKDIR /app
COPY . .
RUN corepack enable && pnpm install --frozen-lockfile
RUN pnpm turbo run build --filter=@nexus/web

FROM nginx:alpine
COPY --from=builder /app/apps/web-v2/dist /usr/share/nginx/html
COPY apps/web-v2/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

### 2.4 无需变更的文件

| 文件 | 原因 |
|------|------|
| `pnpm-workspace.yaml` | `apps/*` 通配已覆盖 `apps/web-v2` |
| `.gitignore` | 已覆盖 `dist`、`node_modules`，`.vite/` 在 app 内 `.gitignore` |
| `.npmrc` | shamefully-hoist 策略无需调整 |
| `.env` / `.env.example` | API 地址等由 `apps/web-v2/.env` 自行管理 |
| `package.json` | monorepo 脚本 (`turbo run dev/build/lint`) 无需变更 |

---

## 三、App 级工程配置（`apps/web-v2/`）

### 3.1 `package.json`

```json
{
  "name": "@nexus/web",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite --port 3034",
    "build": "vue-tsc -b && vite build",
    "preview": "vite preview",
    "lint": "eslint .",
    "check-types": "vue-tsc --noEmit"
  },
  "dependencies": {
    "vue": "^3.5",
    "vue-router": "^4.5",
    "pinia": "^2.3",
    "@tanstack/vue-query": "^5",
    "axios": "^1.18",
    "element-plus": "^2.10",
    "@element-plus/icons-vue": "^2.3",
    "@vueuse/core": "^12",
    "echarts": "^5.6",
    "vue-echarts": "^7",
    "@vue-flow/core": "^1",
    "@vue-flow/background": "^1",
    "@vue-flow/controls": "^1",
    "monaco-editor": "^0.52",
    "zod": "^4",
    "jsencrypt": "^3.5",
    "tailwindcss": "^4",
    "@tailwindcss/vite": "^4"
  },
  "devDependencies": {
    "vite": "^6",
    "@vitejs/plugin-vue": "^5",
    "vue-tsc": "^2",
    "typescript": "^6",
    "eslint": "^9",
    "@eslint/js": "^9",
    "eslint-plugin-vue": "^9",
    "typescript-eslint": "^8",
    "@types/node": "^20"
  }
}
```

关键决策：
- Dev server 端口 **3034**（原 web 占 3033，避免并行开发冲突）
- Vite 6 + `@vitejs/plugin-vue` 官方插件
- `@tailwindcss/vite` 替代 PostCSS 方式集成 Tailwind v4
- Element Plus 替代 HeroUI，`@element-plus/icons-vue` 替代 Lucide React
- Pinia 替代 React Context
- `@tanstack/vue-query` 替代 `@tanstack/react-query`
- `vue-echarts` (ECharts 的 Vue 封装) 用于仪表盘图表
- `@vue-flow` 替代 React Flow（工作流设计器）
- Monaco Editor 直接使用 JS API（无 React 封装依赖）
- `jsencrypt` 保留用于 RSA 密码加密

### 3.2 `vite.config.ts`

```typescript
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'
import { resolve } from 'path'

export default defineConfig({
  plugins: [vue(), tailwindcss()],
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
  server: {
    port: 3034,
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
})
```

### 3.3 `tsconfig.json`

```json
{
  "compilerOptions": {
    "target": "ESNext",
    "lib": ["ESNext", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "preserve",
    "jsxImportSource": "vue",
    "paths": {
      "@/*": ["./src/*"]
    }
  },
  "include": ["src/**/*.ts", "src/**/*.vue", "env.d.ts"],
  "exclude": ["node_modules", "dist"]
}
```

### 3.4 `env.d.ts`

```typescript
/// <reference types="vite/client" />

declare module '*.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<object, object, unknown>
  export default component
}

interface ImportMetaEnv {
  readonly VITE_API_URL: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
```

### 3.5 ESLint 配置

```javascript
import js from '@eslint/js'
import pluginVue from 'eslint-plugin-vue'
import tseslint from 'typescript-eslint'

export default tseslint.config(
  js.configs.recommended,
  ...tseslint.configs.recommended,
  ...pluginVue.configs['flat/recommended'],
  {
    files: ['*.vue', '**/*.vue'],
    languageOptions: {
      parserOptions: { parser: tseslint.parser },
    },
  },
  {
    ignores: ['dist/**', 'node_modules/**'],
  },
)
```

### 3.6 环境变量

```bash
# apps/web-v2/.env
VITE_API_URL=http://localhost:3000
```

对应原 `NEXT_PUBLIC_API_URL`，Vite 使用 `VITE_` 前缀，代码中通过 `import.meta.env.VITE_API_URL` 访问。

### 3.7 `.gitignore`

```
node_modules
dist
.vite
*.local
```

---

## 四、目录结构 & 文件迁移映射

### 4.1 完整目录树

```
apps/web-v2/
├── index.html
├── env.d.ts
├── vite.config.ts
├── tsconfig.json
├── eslint.config.mjs
├── package.json
├── .env
├── .gitignore
└── src/
    ├── App.vue
    ├── main.ts
    │
    ├── api/                       # HTTP 层（原 lib/api/）
    │   ├── client.ts              # Axios 实例 + 拦截器
    │   ├── auth.ts
    │   ├── knowledge-bases.ts
    │   ├── documents.ts
    │   ├── chunks.ts
    │   ├── ai-applications.ts
    │   ├── chat.ts
    │   ├── workflows.ts
    │   ├── models.ts
    │   ├── tools.ts
    │   ├── jobs.ts
    │   ├── prompts.ts
    │   ├── settings.ts
    │   ├── api-keys.ts
    │   └── audit-logs.ts
    │
    ├── stores/                    # Pinia（原 lib/auth/ + config/）
    │   ├── auth.ts
    │   ├── theme.ts
    │   └── breadcrumb.ts
    │
    ├── composables/               # 可组合函数（原 lib/hooks/）
    │   ├── use-knowledge-bases.ts
    │   ├── use-documents.ts
    │   ├── use-chunks.ts
    │   ├── use-ai-applications.ts
    │   ├── use-chat.ts
    │   ├── use-workflows.ts
    │   ├── use-models.ts
    │   ├── use-tools.ts
    │   ├── use-jobs.ts
    │   ├── use-prompts.ts
    │   └── use-settings.ts
    │
    ├── types/                     # TS 类型（原 lib/types/，直接复用）
    │   ├── knowledge-base.ts
    │   ├── document.ts
    │   ├── chunk.ts
    │   ├── ai-application.ts
    │   ├── chat.ts
    │   ├── workflow.ts
    │   ├── model.ts
    │   ├── tool.ts
    │   ├── job.ts
    │   ├── prompt.ts
    │   ├── settings.ts
    │   └── audit-log.ts
    │
    ├── validations/               # Zod schemas（直接复用）
    │   └── auth.ts
    │
    ├── utils/                     # 工具函数（直接复用）
    │   ├── format.ts
    │   ├── constants.ts
    │   └── index.ts
    │
    ├── router/
    │   └── index.ts               # Vue Router 配置 + 路由守卫
    │
    ├── layouts/
    │   └── MainLayout.vue
    │
    ├── components/
    │   ├── layout/
    │   │   ├── AppSidebar.vue     # 替代 sidebar.tsx
    │   │   ├── AppHeader.vue      # 替代 header.tsx
    │   │   └── ThemeSwitcher.vue  # 替代 theme-switcher.tsx
    │   ├── auth/
    │   │   └── AuthCard.vue
    │   ├── knowledge-bases/
    │   │   ├── KbCard.vue
    │   │   ├── KbCreateDialog.vue
    │   │   ├── KbPermission.vue
    │   │   └── UploadDocumentsModal.vue
    │   ├── documents/
    │   │   ├── DocumentTable.vue
    │   │   ├── DocumentUpload.vue
    │   │   ├── DocumentActions.vue
    │   │   ├── ChunkList.vue
    │   │   └── VersionHistory.vue
    │   ├── ai-applications/
    │   │   ├── AppCard.vue
    │   │   ├── AppConfig.vue
    │   │   └── AppCreateDialog.vue
    │   ├── chat/
    │   │   ├── ChatSessionList.vue
    │   │   ├── ChatMessage.vue
    │   │   ├── ChatInput.vue
    │   │   └── CitationCard.vue
    │   ├── workflows/
    │   │   ├── WorkflowCard.vue
    │   │   ├── WorkflowConfig.vue
    │   │   └── ExecutionList.vue
    │   ├── models/
    │   │   ├── ModelCard.vue
    │   │   └── ModelForm.vue
    │   ├── tools/
    │   │   ├── ToolCard.vue
    │   │   └── ToolForm.vue
    │   ├── jobs/
    │   │   ├── JobTable.vue
    │   │   └── JobProgress.vue
    │   ├── prompts/
    │   │   ├── PromptEditor.vue
    │   │   └── PromptVersion.vue
    │   ├── settings/
    │   │   ├── ApiKeyForm.vue
    │   │   ├── RetrieverConfig.vue
    │   │   ├── EmbeddingSelect.vue
    │   │   └── ChunkConfig.vue
    │   └── audit/
    │       └── AuditLogTable.vue
    │
    ├── views/                     # 页面组件（原 app/ 各 page.tsx）
    │   ├── Dashboard.vue
    │   ├── Login.vue
    │   ├── Register.vue
    │   ├── KnowledgeBases.vue
    │   ├── KnowledgeBaseDetail.vue
    │   ├── Documents.vue
    │   ├── DocumentDetail.vue
    │   ├── AiApplications.vue
    │   ├── AiApplicationDetail.vue
    │   ├── Chat.vue
    │   ├── ChatSession.vue
    │   ├── Workflows.vue
    │   ├── WorkflowDetail.vue
    │   ├── WorkflowDesigner.vue
    │   ├── Models.vue
    │   ├── Tools.vue
    │   ├── Jobs.vue
    │   ├── Settings.vue
    │   ├── ApiKeys.vue
    │   ├── Prompts.vue
    │   └── AuditLogs.vue
    │
    ├── styles/
    │   └── globals.css
    │
    └── assets/
        └── logo.svg
```

### 4.2 可直接复用的文件

以下文件为纯 TypeScript / 框架无关代码，**直接复制**到新项目即可：

| 原路径 | 新路径 | 说明 |
|--------|--------|------|
| `src/lib/types/*.ts` | `src/types/*.ts` | 纯 TypeScript 接口/类型 |
| `src/lib/validations/auth.ts` | `src/validations/auth.ts` | 纯 Zod schema |
| `src/lib/utils/format.ts` | `src/utils/format.ts` | 纯工具函数 |
| `src/lib/utils/constants.ts` | `src/utils/constants.ts` | 常量定义 |
| `public/*` | `public/*` 或 `src/assets/*` | 静态资源 |

---

## 五、核心架构设计

### 5.1 应用入口

```typescript
// main.ts
import { createApp } from 'vue'
import { createPinia } from 'pinia'
import { VueQueryPlugin } from '@tanstack/vue-query'
import ElementPlus from 'element-plus'
import 'element-plus/dist/index.css'
import App from './App.vue'
import router from './router'
import '@/styles/globals.css'

const app = createApp(App)
app.use(createPinia())
app.use(router)
app.use(ElementPlus)
app.use(VueQueryPlugin, {
  queryClientConfig: {
    defaultOptions: {
      queries: { retry: 1, staleTime: 30_000, refetchOnWindowFocus: false },
    },
  },
})
app.mount('#app')
```

### 5.2 路由设计（Vue Router）

**路由守卫逻辑**：
- 页面加载时从 `localStorage` 读取 token，调用 `/user/info` 恢复登录态
- `meta.requiresAuth: true` → 未登录重定向 `/login?redirect=xxx`
- `meta.guest: true` → 已登录时重定向首页
- 所有视图组件使用懒加载 `() => import(...)`，Vite 自动代码分割

**路由映射表**：

| Vue Router path | 视图组件 | Meta |
|---|---|---|
| `/login` | `Login.vue` | guest |
| `/register` | `Register.vue` | guest |
| `/` | `Dashboard.vue` | requiresAuth |
| `/knowledge-bases` | `KnowledgeBases.vue` | requiresAuth |
| `/knowledge-bases/:kbId` | `KnowledgeBaseDetail.vue` | requiresAuth |
| `/knowledge-bases/documents` | `Documents.vue` | requiresAuth |
| `/knowledge-bases/documents/:id` | `DocumentDetail.vue` | requiresAuth |
| `/ai-applications` | `AiApplications.vue` | requiresAuth |
| `/ai-applications/:appId` | `AiApplicationDetail.vue` | requiresAuth |
| `/chat` | `Chat.vue` | requiresAuth |
| `/chat/:sessionId` | `ChatSession.vue` | requiresAuth |
| `/workflows` | `Workflows.vue` | requiresAuth |
| `/workflows/:id` | `WorkflowDetail.vue` | requiresAuth |
| `/workflows/designer` | `WorkflowDesigner.vue` | requiresAuth |
| `/models` | `Models.vue` | requiresAuth |
| `/tools` | `Tools.vue` | requiresAuth |
| `/jobs` | `Jobs.vue` | requiresAuth |
| `/settings` | `Settings.vue` | requiresAuth |
| `/settings/api-keys` | `ApiKeys.vue` | requiresAuth |
| `/settings/prompts` | `Prompts.vue` | requiresAuth |
| `/audit-logs` | `AuditLogs.vue` | requiresAuth |

### 5.3 API 层（Axios）

**`api/client.ts`** 与当前版本核心逻辑一致，仅做以下适配：

| 原逻辑 | Vue 3 适配 |
|--------|-----------|
| `process.env.NEXT_PUBLIC_API_URL` | `import.meta.env.VITE_API_URL` |
| SSR 环境检查 `typeof window !== 'undefined'` | 移除（Vite SPA 始终在浏览器环境） |
| 401 跳转 `window.location.href = '/login'` | 保留 `window.location.href` 方式（避免与 router 循环依赖） |

拦截器逻辑（Bearer token 注入、`ApiResponse` 解包、统一错误处理）**完全不变**。

### 5.4 状态管理（Pinia）

#### `stores/auth.ts` — 替代 `lib/auth/auth-context.tsx`

```typescript
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { authApi, getToken, removeToken } from '@/api/auth'

export const useAuthStore = defineStore('auth', () => {
  const user = ref<UserInfo | null>(null)
  const isLoading = ref(true)
  const initialized = ref(false)

  const isAuthenticated = computed(() => !!user.value)

  async function refreshUser() { /* 从 token 恢复登录态 */ }
  function setUser(data: LoginResponse) { user.value = data.user }
  async function logout() { /* 调用登出接口 + 清除 token */ }

  return { user, isLoading, initialized, isAuthenticated, refreshUser, setUser, logout }
})
```

#### `stores/theme.ts` — 替代 `next-themes`

- 管理 `light` / `dark` 切换
- 通过 `watchEffect` 同步 `<html>` 的 `.dark` class
- 持久化到 `localStorage`

#### `stores/breadcrumb.ts` — 替代 `config/breadcrumb-context.tsx`

- 使用 Pinia 的 `ref` 替代 React 的 `useSyncExternalStore`
- 提供 `setLabels()` 方法，页面在 `onMounted` 中调用

### 5.5 服务端状态（TanStack Query Vue）

以 Knowledge Bases 为例：

```typescript
// composables/use-knowledge-bases.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/vue-query'
import { knowledge_basesApi } from '@/api/knowledge-bases'

export function useKnowledgeBases() {
  return useQuery({
    queryKey: ['knowledge-bases'],
    queryFn: () => knowledge_basesApi.list(),
  })
}

export function useKnowledgeBase(id: MaybeRef<string>) {
  return useQuery({
    queryKey: ['knowledge-bases', id],
    queryFn: () => knowledge_basesApi.get(toValue(id)),
    enabled: () => !!toValue(id),
  })
}

export function useCreateKnowledgeBase() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: knowledge_basesApi.create,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['knowledge-bases'] }),
  })
}
```

### 5.6 布局

```
┌──────────────────────────────────────────────┐
│ App.vue                                      │
│   <router-view />  ───  根据路由 meta 渲染:   │
│                                              │
│   /login, /register                          │
│   └── 直接渲染 AuthCard (无布局)              │
│                                              │
│   其他路由                                    │
│   └── MainLayout.vue                         │
│       ┌──────────┬──────────────────────┐    │
│       │ Sidebar  │ Header (面包屑 + 用户) │    │
│       │          ├──────────────────────┤    │
│       │ 导航链接  │ <router-view />      │    │
│       │          │ (页面内容)            │    │
│       └──────────┴──────────────────────┘    │
└──────────────────────────────────────────────┘
```

结构完全对齐原 `MainLayout`（Sidebar + Header + main content）。

---

## 六、样式方案

### 6.1 策略

**Tailwind CSS + Element Plus CSS 变量覆盖**。将原 HeroUI 的 Design Token (`--accent`, `--surface`, `--border` 等) 桥接到 Element Plus 的 CSS 变量体系 (`--el-color-primary`, `--el-bg-color` 等)，保留原项目的整体视觉风格。

### 6.2 Element Plus 组件 vs HeroUI 组件对照

| HeroUI | Element Plus | 迁移说明 |
|---|---|---|
| `<Card>` `<CardHeader>` `<CardContent>` | `<el-card>` | 直接用 |
| `<Button>` | `<el-button>` | 直接用 |
| `<Input>` `<Textarea>` | `<el-input>` | 直接用 |
| `<Dropdown.Root>` `<Dropdown.Trigger>` `<Dropdown.Menu>` | `<el-dropdown>` | API 不同，需改写 |
| `<Breadcrumbs>` | `<el-breadcrumb>` | 直接用 |
| `<Modal>` `<Dialog>` | `<el-dialog>` | 直接用 |
| `<Table>` | `<el-table>` | 直接用 |
| `<Form>` | `<el-form>` | 直接用 |
| `<Select>` | `<el-select>` | 直接用 |
| `<Tabs>` | `<el-tabs>` | 直接用 |
| `<Badge>` `<Chip>` | `<el-tag>` | 直接用 |
| `<Tooltip>` | `<el-tooltip>` | 直接用 |
| `<Avatar>` | `<el-avatar>` | 直接用 |
| `<Spinner>` `<Progress>` | `<el-progress>` / `<el-skeleton>` | 直接用 |
| `<Pagination>` | `<el-pagination>` | 直接用 |
| `<Switch>` `<Checkbox>` `<Radio>` | `<el-switch>` `<el-checkbox>` `<el-radio>` | 直接用 |
| Lucide React icons | `@element-plus/icons-vue` | 图标名不同，需逐个替换 |

---

## 七、迁移实施顺序

```
Phase 1: 工程骨架（1 天）
├── 创建 apps/web-v2 目录
├── package.json / vite.config.ts / tsconfig.json / eslint / .env
├── index.html / main.ts / App.vue
├── styles/globals.css
└── 验证：vite dev 启动空页面

Phase 2: 基础设施（1 天）
├── router/index.ts（路由 + 守卫）
├── api/client.ts（Axios + 拦截器）
├── api/auth.ts
├── stores/auth.ts / theme.ts / breadcrumb.ts
├── layouts/MainLayout.vue + AppSidebar.vue + AppHeader.vue
├── types/ 和 utils/ 直接复制
└── 验证：登录/登出流程可用

Phase 3: 核心页面（3-4 天）
├── Login.vue / Register.vue — 首个完整迁移页面
├── Dashboard.vue
├── KnowledgeBases.vue + KnowledgeBaseDetail.vue
├── Documents.vue + DocumentDetail.vue
├── Chat.vue + ChatSession.vue
├── AiApplications.vue + AiApplicationDetail.vue
└── 每完成一个页面独立验证

Phase 4: 功能页面（2-3 天）
├── Workflows.vue + WorkflowDetail.vue + WorkflowDesigner.vue
├── Models.vue + ModelForm.vue
├── Tools.vue + ToolForm.vue
├── Jobs.vue + JobTable.vue + JobProgress.vue
└── 验证：Monaco Editor 和 Vue Flow 集成

Phase 5: 设置 & 审计（1-2 天）
├── Settings.vue + ApiKeys.vue + Prompts.vue
├── AuditLogs.vue
├── 面包屑优化
├── 主题切换完善
└── 验证：全功能联调

Phase 6: 收尾（1 天）
├── docker/web.Dockerfile 重写
├── nginx.conf 配置
├── README 重写
├── 全量功能回归测试
└── 切换：反向代理指向 web-v2
```

### 预估总工期：9-12 天

---

## 八、配置变更汇总

| 文件 | 操作 | 说明 |
|------|------|------|
| `apps/web-v2/` | **新增** | 新 Vue 3 项目目录 |
| `turbo.json` | 修改 | `outputs` 增加 `.vite/**` |
| `docker/web.Dockerfile` | 重写 | Vite + Vue 3 多阶段构建 |
| `pnpm-workspace.yaml` | 无需改 | `apps/*` 已覆盖 |
| `.gitignore` | 无需改 | 已覆盖所需模式 |
| `.env` / `.env.example` | 无需改 | 环境变量在 app 内配置 |
| `.npmrc` | 无需改 | shamefully-hoist 策略不变 |
| `package.json` (root) | 无需改 | turbo scripts 不变 |

---

## 九、风险和注意事项

1. **Element Plus Dropdown API 差异**：HeroUI 的 `<Dropdown>` 采用复合组件模式（Root/Trigger/Menu），Element Plus 的 `<el-dropdown>` 使用插槽方式，Header 的用户菜单需要重点适配。

2. **Monaco Editor 集成**：当前项目未使用 Monaco Editor（Workflow Designer 页面待开发），Vue 中直接使用 `monaco-editor` JS API + `@vueuse/core` 的 `useElementSize` 即可，无需额外封装库。

3. **Vue Flow 集成**：Workflow Designer 同理，Vue Flow 提供与 React Flow 相似的 API，迁移需注意事件处理和双向绑定方式的差异。

4. **图标差异**：Lucide React 图标名与 `@element-plus/icons-vue` 不完全对应，需要建立映射表逐个替换。

5. **Zod v4 兼容性**：当前已使用 Zod v4，Vue 项目中直接使用 Zod schema 做表单校验（无需 `@hookform/resolvers`），使用 Vue 的 `reactive` + `computed` 管理表单状态和错误信息。

6. **SEO/SSR**：当前项目为后台管理平台，无需 SSR。Vite SPA 模式完全满足需求。
