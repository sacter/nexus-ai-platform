# Web Vue3 重构 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将 `apps/web` (Next.js 16 + HeroUI + React) 全量重写为 `apps/web-v2` (Vue 3 + Element Plus + Vite)

**Architecture:** 新建独立 `apps/web-v2` 目录，分层架构：`api/` (Axios) → `stores/` (Pinia) / `composables/` (TanStack Query Vue) → `views/` (页面) + `components/` (组件) + `layouts/` (布局)，Vue Router 4 管理路由，Tailwind CSS 4 + Element Plus CSS 变量桥接主题

**Tech Stack:** Vue 3.5, Vite 6, TypeScript 6, Element Plus 2.10, Pinia 2, TanStack Query Vue 5, Vue Router 4, Axios, Tailwind CSS 4, Zod 4

**Source spec:** `docs/superpowers/specs/2026-07-30-web-vue3-rebuild-design.md`

---

## File Structure Map

```
apps/web-v2/
├── index.html                          # SPA 入口 HTML
├── env.d.ts                            # Vite/Vue 类型声明
├── vite.config.ts                      # Vite 构建配置
├── tsconfig.json                       # TypeScript 配置
├── eslint.config.mjs                   # ESLint 配置
├── package.json                        # 依赖与脚本
├── .env                                # 环境变量
├── .gitignore                          # Git 忽略规则
└── src/
    ├── App.vue                         # 根组件
    ├── main.ts                         # 应用入口
    ├── api/
    │   ├── client.ts                   # Axios 实例 + 拦截器
    │   └── auth.ts                     # 认证 API（后续 Task 补全其余模块）
    ├── stores/
    │   ├── auth.ts                     # 认证状态
    │   ├── theme.ts                    # 主题切换
    │   └── breadcrumb.ts               # 面包屑标签
    ├── types/                          # 直接复制自 web/src/lib/types/
    ├── utils/                          # 直接复制自 web/src/lib/utils/
    ├── validations/                    # 直接复制自 web/src/lib/validations/
    ├── router/
    │   └── index.ts                    # Vue Router 配置 + 守卫
    ├── layouts/
    │   └── MainLayout.vue              # 主布局（Sidebar + Header + 内容）
    ├── components/
    │   └── layout/
    │       ├── AppSidebar.vue          # 侧边栏导航
    │       ├── AppHeader.vue           # Header + 面包屑 + 用户菜单
    │       └── ThemeSwitcher.vue       # 主题切换按钮
    ├── views/                          # 各页面组件
    └── styles/
        └── globals.css                 # Tailwind + Element Plus 主题
```

---

## Phase 1: 工程骨架

### Task 1: 创建目录结构和 package.json

**Files:**
- Create: `apps/web-v2/package.json`

- [ ] **Step 1: 创建目录**

```bash
mkdir -p apps/web-v2/src/{api,stores,composables,types,utils,validations,router,layouts,components/layout,views,styles,assets}
```

- [ ] **Step 2: 创建 package.json**

Write `apps/web-v2/package.json`:

```json
{
  "name": "@nexus/web-v2",
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
    "vue": "^3.5.13",
    "vue-router": "^4.5.0",
    "pinia": "^2.3.0",
    "@tanstack/vue-query": "^5.67.0",
    "axios": "^1.18.1",
    "element-plus": "^2.10.0",
    "@element-plus/icons-vue": "^2.3.2",
    "@vueuse/core": "^12.8.0",
    "echarts": "^5.6.0",
    "vue-echarts": "^7.0.3",
    "@vue-flow/core": "^1.44.0",
    "@vue-flow/background": "^1.4.0",
    "@vue-flow/controls": "^1.1.0",
    "monaco-editor": "^0.52.2",
    "zod": "^4.4.3",
    "jsencrypt": "^3.5.4",
    "tailwindcss": "^4.1.0",
    "@tailwindcss/vite": "^4.1.0"
  },
  "devDependencies": {
    "vite": "^6.3.0",
    "@vitejs/plugin-vue": "^5.2.0",
    "vue-tsc": "^2.2.0",
    "typescript": "^6.0.3",
    "eslint": "^9.0.0",
    "@eslint/js": "^9.0.0",
    "eslint-plugin-vue": "^9.33.0",
    "typescript-eslint": "^8.30.0",
    "@types/node": "^20.17.0"
  }
}
```

- [ ] **Step 3: 安装依赖**

```bash
cd /Users/aibee/Documents/code/demo/agent/nexus-ai-platform && pnpm install
```

- [ ] **Step 4: 验证**

```bash
ls apps/web-v2/node_modules/vue  # 应存在
```

- [ ] **Step 5: Commit**

```bash
git add apps/web-v2/package.json pnpm-lock.yaml
git commit -m "feat(web-v2): scaffold directory structure and package.json

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 2: 创建 Vite 和 TypeScript 配置文件

**Files:**
- Create: `apps/web-v2/vite.config.ts`
- Create: `apps/web-v2/tsconfig.json`
- Create: `apps/web-v2/env.d.ts`

- [ ] **Step 1: 创建 vite.config.ts**

Write `apps/web-v2/vite.config.ts`:

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

- [ ] **Step 2: 创建 tsconfig.json**

Write `apps/web-v2/tsconfig.json`:

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

- [ ] **Step 3: 创建 env.d.ts**

Write `apps/web-v2/env.d.ts`:

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

- [ ] **Step 4: Commit**

```bash
git add apps/web-v2/vite.config.ts apps/web-v2/tsconfig.json apps/web-v2/env.d.ts
git commit -m "feat(web-v2): add vite, typescript, and env type configs

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 3: 创建 ESLint、环境变量、gitignore 配置

**Files:**
- Create: `apps/web-v2/eslint.config.mjs`
- Create: `apps/web-v2/.env`
- Create: `apps/web-v2/.gitignore`

- [ ] **Step 1: 创建 eslint.config.mjs**

Write `apps/web-v2/eslint.config.mjs`:

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

- [ ] **Step 2: 创建 .env**

Write `apps/web-v2/.env`:

```bash
VITE_API_URL=http://localhost:3000
```

- [ ] **Step 3: 创建 .gitignore**

Write `apps/web-v2/.gitignore`:

```
node_modules
dist
.vite
*.local
```

- [ ] **Step 4: Commit**

```bash
git add apps/web-v2/eslint.config.mjs apps/web-v2/.env apps/web-v2/.gitignore
git commit -m "feat(web-v2): add eslint config, env vars, and gitignore

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 4: 创建应用入口文件（index.html, main.ts, App.vue）

**Files:**
- Create: `apps/web-v2/index.html`
- Create: `apps/web-v2/src/main.ts`
- Create: `apps/web-v2/src/App.vue`

- [ ] **Step 1: 创建 index.html**

Write `apps/web-v2/index.html`:

```html
<!DOCTYPE html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Nexus AI Platform</title>
  </head>
  <body class="h-full antialiased">
    <div id="app"></div>
    <script type="module" src="/src/main.ts"></script>
  </body>
</html>
```

- [ ] **Step 2: 创建 main.ts**

Write `apps/web-v2/src/main.ts`:

```typescript
import { createApp } from 'vue'
import { createPinia } from 'pinia'
import { VueQueryPlugin } from '@tanstack/vue-query'
import ElementPlus from 'element-plus'
import 'element-plus/dist/index.css'
import App from './App.vue'
import router from './router'
import './styles/globals.css'

const app = createApp(App)

app.use(createPinia())
app.use(router)
app.use(ElementPlus)
app.use(VueQueryPlugin, {
  queryClientConfig: {
    defaultOptions: {
      queries: {
        retry: 1,
        staleTime: 30_000,
        refetchOnWindowFocus: false,
      },
    },
  },
})

app.mount('#app')
```

- [ ] **Step 3: 创建 App.vue**

Write `apps/web-v2/src/App.vue`:

```vue
<template>
  <router-view />
</template>
```

- [ ] **Step 4: 验证项目能启动（需先完成 Task 5 styles + Task 6 router 占位）**

暂不单独验证，待 Task 7 一并验证。

- [ ] **Step 5: Commit**

```bash
git add apps/web-v2/index.html apps/web-v2/src/main.ts apps/web-v2/src/App.vue
git commit -m "feat(web-v2): create app entry files (index.html, main.ts, App.vue)

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 5: 创建全局样式

**Files:**
- Create: `apps/web-v2/src/styles/globals.css`

- [ ] **Step 1: 创建 globals.css**

Write `apps/web-v2/src/styles/globals.css`:

```css
@import "tailwindcss";

@custom-variant dark (&:is(.dark *));

/* ============================================
   Element Plus 主题变量 — 桥接原 HeroUI Design Token
   ============================================ */

:root {
  --el-color-primary: oklch(0 0 0);
  --el-color-primary-light-3: oklch(40% 0 0);
  --el-color-primary-light-5: oklch(60% 0 0);
  --el-color-primary-light-7: oklch(80% 0 0);
  --el-color-primary-light-9: oklch(95% 0 0);

  --el-bg-color: oklch(100.00% 0.0000 0.00);
  --el-bg-color-page: oklch(97.02% 0.0000 0.00);
  --el-bg-color-overlay: oklch(100.00% 0.0000 0.00);

  --el-border-color: oklch(90.00% 0.0000 0.00);
  --el-text-color-primary: oklch(21.03% 0.0000 0.00);
  --el-text-color-regular: oklch(21.03% 0.0000 0.00);
  --el-text-color-secondary: oklch(55.17% 0.0000 0.00);

  --el-border-radius-base: 4px;

  /* 原 HeroUI 语义变量（Sidebar/Header 用 Tailwind 类名引用） */
  --surface: oklch(100.00% 0.0000 0.00);
  --surface-secondary: oklch(95.24% 0.0000 0.00);
  --border: oklch(90.00% 0.0000 0.00);
  --accent: oklch(0 0 0);
  --foreground: oklch(21.03% 0.0000 0.00);
}

.dark {
  --el-color-primary: oklch(0.9848 0 0);
  --el-color-primary-light-3: oklch(70% 0 0);
  --el-color-primary-light-5: oklch(50% 0 0);
  --el-color-primary-light-7: oklch(35% 0 0);
  --el-color-primary-light-9: oklch(20% 0 0);

  --el-bg-color: oklch(21.03% 0.0000 0.00);
  --el-bg-color-page: oklch(12.00% 0.0000 0.00);
  --el-bg-color-overlay: oklch(21.03% 0.0000 0.00);

  --el-border-color: oklch(28.00% 0.0000 0.00);
  --el-text-color-primary: oklch(99.11% 0.0000 0.00);
  --el-text-color-regular: oklch(99.11% 0.0000 0.00);
  --el-text-color-secondary: oklch(70.50% 0.0000 0.00);

  --surface: oklch(21.03% 0.0000 0.00);
  --surface-secondary: oklch(25.70% 0.0000 0.00);
  --border: oklch(28.00% 0.0000 0.00);
  --accent: oklch(0.9848 0 0);
  --foreground: oklch(99.11% 0.0000 0.00);
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web-v2/src/styles/globals.css
git commit -m "feat(web-v2): add global styles with Element Plus + Tailwind CSS theme bridge

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 6: 创建占位 Router（使项目能启动）

**Files:**
- Create: `apps/web-v2/src/router/index.ts`

- [ ] **Step 1: 创建最小可运行 router**

Write `apps/web-v2/src/router/index.ts`:

```typescript
import { createRouter, createWebHistory } from 'vue-router'
import type { RouteRecordRaw } from 'vue-router'

const routes: RouteRecordRaw[] = [
  {
    path: '/',
    name: 'Home',
    component: () => import('@/views/Dashboard.vue'),
  },
]

const router = createRouter({
  history: createWebHistory(),
  routes,
})

export default router
```

- [ ] **Step 2: 创建占位 Dashboard.vue**

Write `apps/web-v2/src/views/Dashboard.vue`:

```vue
<template>
  <div class="p-8">
    <h1 class="text-2xl font-semibold text-foreground">平台概览</h1>
    <p class="text-foreground/60 mt-2">Nexus AI Platform — Vue 3</p>
  </div>
</template>
```

- [ ] **Step 3: 启动项目验证**

```bash
cd apps/web-v2 && npx vite --port 3034
```

验证：浏览器打开 `http://localhost:3034`，看到 "平台概览" 和 "Nexus AI Platform — Vue 3" 文字。

- [ ] **Step 4: Commit**

```bash
git add apps/web-v2/src/router/index.ts apps/web-v2/src/views/Dashboard.vue
git commit -m "feat(web-v2): add placeholder router and dashboard view

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 7: 更新 turbo.json

**Files:**
- Modify: `turbo.json:5`

- [ ] **Step 1: 更新 outputs 配置**

Edit `turbo.json`，将 `"outputs": ["dist/**", ".next/**"]` 改为 `"outputs": ["dist/**", ".next/**", ".vite/**"]`。

Use the Edit tool:

```json
{
  "file_path": "/Users/aibee/Documents/code/demo/agent/nexus-ai-platform/turbo.json",
  "old_string": "\"outputs\": [\"dist/**\", \".next/**\"]",
  "new_string": "\"outputs\": [\"dist/**\", \".next/**\", \".vite/**\"]"
}
```

- [ ] **Step 2: Commit**

```bash
git add turbo.json
git commit -m "chore(turbo): add .vite cache to build outputs for web-v2

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Phase 2: 基础设施

### Task 8: 复制类型定义文件（types/）

**Files:**
- Create: `apps/web-v2/src/types/*.ts`

- [ ] **Step 1: 批量复制类型文件**

```bash
cp apps/web/src/lib/types/*.ts apps/web-v2/src/types/
```

- [ ] **Step 2: 验证**

```bash
ls apps/web-v2/src/types/  # 应看到 12 个 .ts 文件
```

- [ ] **Step 3: Commit**

```bash
git add apps/web-v2/src/types/
git commit -m "feat(web-v2): copy type definitions from web (framework-agnostic)

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 9: 复制工具函数和校验文件（utils/, validations/）

**Files:**
- Create: `apps/web-v2/src/utils/*.ts`
- Create: `apps/web-v2/src/validations/auth.ts`

- [ ] **Step 1: 批量复制**

```bash
cp apps/web/src/lib/utils/*.ts apps/web-v2/src/utils/
cp apps/web/src/lib/validations/*.ts apps/web-v2/src/validations/
```

- [ ] **Step 2: 验证**

```bash
ls apps/web-v2/src/utils/   # 应看到 format.ts, constants.ts, index.ts
ls apps/web-v2/src/validations/  # 应看到 auth.ts
```

- [ ] **Step 3: Commit**

```bash
git add apps/web-v2/src/utils/ apps/web-v2/src/validations/
git commit -m "feat(web-v2): copy utils and validation files from web

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 10: 创建 Axios 客户端（api/client.ts）

**Files:**
- Create: `apps/web-v2/src/api/client.ts`

- [ ] **Step 1: 创建 client.ts**

Write `apps/web-v2/src/api/client.ts`:

```typescript
import axios from 'axios'

interface ApiResponse<T = unknown> {
  code: number
  message: string
  data: T | null
  timestamp: string
  path: string
}

const instance = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? 'http://localhost:3000',
  timeout: 30000,
  headers: { 'Content-Type': 'application/json' },
})

instance.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

instance.interceptors.response.use(
  ((response: { data: unknown }) => {
    const body = response.data as ApiResponse
    if (body !== null && typeof body === 'object' && 'code' in body) {
      if (body.code === 0) {
        return body.data
      }
      return Promise.reject(new Error(body.message || '请求失败'))
    }
    return body
  }) as never,
  (error) => {
    if (error.response?.status === 401) {
      const path = window.location.pathname
      if (path !== '/login' && path !== '/register') {
        localStorage.removeItem('token')
        window.location.href = '/login'
      }
    }

    const serverMessage = error.response?.data?.message
    const message = serverMessage || error.message || '网络异常，请稍后重试'

    return Promise.reject(new Error(message))
  },
)

const http = instance as unknown as {
  get<T = unknown>(url: string, config?: Record<string, unknown>): Promise<T>
  post<T = unknown>(url: string, data?: unknown, config?: Record<string, unknown>): Promise<T>
  patch<T = unknown>(url: string, data?: unknown, config?: Record<string, unknown>): Promise<T>
  delete<T = unknown>(url: string, config?: Record<string, unknown>): Promise<T>
}

export default http
```

- [ ] **Step 2: Commit**

```bash
git add apps/web-v2/src/api/client.ts
git commit -m "feat(web-v2): create axios client with auth interceptors

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 11: 创建认证 API 模块（api/auth.ts）

**Files:**
- Create: `apps/web-v2/src/api/auth.ts`

- [ ] **Step 1: 创建 auth.ts**

Write `apps/web-v2/src/api/auth.ts`:

```typescript
import http from './client'

export interface CaptchaData {
  captchaId: string
  svg: string
}

export interface UserInfo {
  id: string
  username: string
  email: string
  role: string
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export interface LoginResponse {
  accessToken: string
  user: UserInfo
}

interface PublicKeyResponse {
  publicKey: string
}

let cachedPublicKey: string | null = null

export const clearPublicKeyCache = (): void => {
  cachedPublicKey = null
}

export const getToken = (): string | null => {
  return localStorage.getItem('token')
}

export const setToken = (token: string): void => {
  localStorage.setItem('token', token)
}

export const removeToken = (): void => {
  localStorage.removeItem('token')
}

export const isAuthenticated = (): boolean => {
  return !!getToken()
}

export const authApi = {
  getCaptcha: () => http.get<CaptchaData>('/auth/captcha'),

  getPublicKey: async (): Promise<string> => {
    if (cachedPublicKey) return cachedPublicKey
    const data = await http.get<PublicKeyResponse>('/auth/public-key')
    cachedPublicKey = data.publicKey
    return cachedPublicKey
  },

  encryptPassword: async (password: string): Promise<string> => {
    const publicKey = await authApi.getPublicKey()
    const { JSEncrypt } = await import('jsencrypt')
    const encrypt = new JSEncrypt()
    encrypt.setPublicKey(publicKey)
    const encrypted = encrypt.encrypt(password)
    if (!encrypted) {
      throw new Error('密码加密失败，请刷新页面后重试')
    }
    return encrypted
  },

  login: async (
    username: string,
    password: string,
    captchaId: string,
    captchaCode: string,
  ): Promise<LoginResponse> => {
    const encryptedPassword = await authApi.encryptPassword(password)
    const data = await http.post<LoginResponse>('/auth/login', {
      username,
      encryptedPassword,
      captchaId,
      captchaCode,
    })
    setToken(data.accessToken)
    return data
  },

  register: async (
    username: string,
    email: string,
    password: string,
    captchaId: string,
    captchaCode: string,
  ): Promise<void> => {
    const encryptedPassword = await authApi.encryptPassword(password)
    await http.post('/auth/register', {
      username,
      email,
      encryptedPassword,
      captchaId,
      captchaCode,
    })
  },

  getUserInfo: () => http.get<UserInfo>('/user/info'),

  logout: () => http.post<void>('/auth/logout'),
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web-v2/src/api/auth.ts
git commit -m "feat(web-v2): create auth API module with RSA encryption

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 12: 创建 Pinia Stores

**Files:**
- Create: `apps/web-v2/src/stores/auth.ts`
- Create: `apps/web-v2/src/stores/theme.ts`
- Create: `apps/web-v2/src/stores/breadcrumb.ts`

- [ ] **Step 1: 创建 stores/auth.ts**

Write `apps/web-v2/src/stores/auth.ts`:

```typescript
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import {
  authApi,
  getToken,
  removeToken,
  type UserInfo,
  type LoginResponse,
} from '@/api/auth'

export const useAuthStore = defineStore('auth', () => {
  const user = ref<UserInfo | null>(null)
  const isLoading = ref(true)
  const initialized = ref(false)

  const isAuthenticated = computed(() => !!user.value)

  async function refreshUser() {
    try {
      const token = getToken()
      if (!token) {
        user.value = null
        return
      }
      user.value = await authApi.getUserInfo()
    } catch {
      removeToken()
      user.value = null
    } finally {
      isLoading.value = false
      initialized.value = true
    }
  }

  function setUser(data: LoginResponse) {
    user.value = data.user
  }

  async function logout() {
    try {
      await authApi.logout()
    } catch {
      // 登出接口失败不影响本地清除
    }
    removeToken()
    user.value = null
  }

  return {
    user,
    isLoading,
    initialized,
    isAuthenticated,
    refreshUser,
    setUser,
    logout,
  }
})
```

- [ ] **Step 2: 创建 stores/theme.ts**

Write `apps/web-v2/src/stores/theme.ts`:

```typescript
import { defineStore } from 'pinia'
import { ref, watchEffect } from 'vue'

export const useThemeStore = defineStore('theme', () => {
  const theme = ref<'light' | 'dark'>(
    (localStorage.getItem('theme') as 'light' | 'dark') || 'light',
  )

  watchEffect(() => {
    document.documentElement.classList.toggle('dark', theme.value === 'dark')
    localStorage.setItem('theme', theme.value)
  })

  function toggle() {
    theme.value = theme.value === 'light' ? 'dark' : 'light'
  }

  return { theme, toggle }
})
```

- [ ] **Step 3: 创建 stores/breadcrumb.ts**

Write `apps/web-v2/src/stores/breadcrumb.ts`:

```typescript
import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useBreadcrumbStore = defineStore('breadcrumb', () => {
  const segmentLabels = ref<Record<string, string>>({})

  function setLabels(labels: Record<string, string>) {
    segmentLabels.value = labels
  }

  return { segmentLabels, setLabels }
})
```

- [ ] **Step 4: Commit**

```bash
git add apps/web-v2/src/stores/
git commit -m "feat(web-v2): create pinia stores (auth, theme, breadcrumb)

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 13: 创建完整 Vue Router 配置

**Files:**
- Modify: `apps/web-v2/src/router/index.ts`

- [ ] **Step 1: 重写 router/index.ts（替换占位实现）**

Write `apps/web-v2/src/router/index.ts`:

```typescript
import { createRouter, createWebHistory } from 'vue-router'
import type { RouteRecordRaw } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

const routes: RouteRecordRaw[] = [
  // --- 无布局路由 ---
  {
    path: '/login',
    name: 'Login',
    component: () => import('@/views/Login.vue'),
    meta: { guest: true },
  },
  {
    path: '/register',
    name: 'Register',
    component: () => import('@/views/Register.vue'),
    meta: { guest: true },
  },

  // --- 带布局路由 ---
  {
    path: '/',
    component: () => import('@/layouts/MainLayout.vue'),
    meta: { requiresAuth: true },
    children: [
      { path: '', name: 'Dashboard', component: () => import('@/views/Dashboard.vue') },
      { path: 'knowledge-bases', name: 'KnowledgeBases', component: () => import('@/views/KnowledgeBases.vue') },
      { path: 'knowledge-bases/:kbId', name: 'KnowledgeBaseDetail', component: () => import('@/views/KnowledgeBaseDetail.vue') },
      { path: 'knowledge-bases/documents', name: 'Documents', component: () => import('@/views/Documents.vue') },
      { path: 'knowledge-bases/documents/:id', name: 'DocumentDetail', component: () => import('@/views/DocumentDetail.vue') },
      { path: 'ai-applications', name: 'AiApplications', component: () => import('@/views/AiApplications.vue') },
      { path: 'ai-applications/:appId', name: 'AiApplicationDetail', component: () => import('@/views/AiApplicationDetail.vue') },
      { path: 'chat', name: 'Chat', component: () => import('@/views/Chat.vue') },
      { path: 'chat/:sessionId', name: 'ChatSession', component: () => import('@/views/ChatSession.vue') },
      { path: 'workflows', name: 'Workflows', component: () => import('@/views/Workflows.vue') },
      { path: 'workflows/:id', name: 'WorkflowDetail', component: () => import('@/views/WorkflowDetail.vue') },
      { path: 'workflows/designer', name: 'WorkflowDesigner', component: () => import('@/views/WorkflowDesigner.vue') },
      { path: 'models', name: 'Models', component: () => import('@/views/Models.vue') },
      { path: 'tools', name: 'Tools', component: () => import('@/views/Tools.vue') },
      { path: 'jobs', name: 'Jobs', component: () => import('@/views/Jobs.vue') },
      { path: 'settings', name: 'Settings', component: () => import('@/views/Settings.vue') },
      { path: 'settings/api-keys', name: 'ApiKeys', component: () => import('@/views/ApiKeys.vue') },
      { path: 'settings/prompts', name: 'Prompts', component: () => import('@/views/Prompts.vue') },
      { path: 'audit-logs', name: 'AuditLogs', component: () => import('@/views/AuditLogs.vue') },
    ],
  },
]

const router = createRouter({
  history: createWebHistory(),
  routes,
})

router.beforeEach(async (to, _from, next) => {
  const auth = useAuthStore()

  if (!auth.initialized) {
    await auth.refreshUser()
  }

  if (to.meta.requiresAuth && !auth.isAuthenticated) {
    next({ name: 'Login', query: { redirect: to.fullPath } })
  } else if (to.meta.guest && auth.isAuthenticated) {
    next({ name: 'Dashboard' })
  } else {
    next()
  }
})

export default router
```

- [ ] **Step 2: Commit**

```bash
git add apps/web-v2/src/router/index.ts
git commit -m "feat(web-v2): implement full vue router with auth guards

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 14: 创建布局组件

**Files:**
- Create: `apps/web-v2/src/layouts/MainLayout.vue`
- Create: `apps/web-v2/src/components/layout/AppSidebar.vue`
- Create: `apps/web-v2/src/components/layout/AppHeader.vue`
- Create: `apps/web-v2/src/components/layout/ThemeSwitcher.vue`

- [ ] **Step 1: 创建 AppSidebar.vue**

Write `apps/web-v2/src/components/layout/AppSidebar.vue`:

```vue
<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  Monitor,
  Collection,
  Cpu,
  ChatDotSquare,
  Share,
  Coin,
  Switch,
  Timer,
  Setting,
  Lock,
} from '@element-plus/icons-vue'

const navItems = [
  { href: '/', label: '仪表盘', icon: Monitor },
  { href: '/knowledge-bases', label: '知识库', icon: Collection },
  { href: '/ai-applications', label: 'AI 应用', icon: Cpu },
  { href: '/chat', label: '对话', icon: ChatDotSquare },
  { href: '/workflows', label: 'Workflow', icon: Share },
  { href: '/models', label: '模型', icon: Coin },
  { href: '/tools', label: '工具', icon: Switch },
  { href: '/jobs', label: 'Job', icon: Timer },
  { href: '/settings', label: '设置', icon: Setting },
  { href: '/audit-logs', label: '审计', icon: Lock },
]

const route = useRoute()
const router = useRouter()

function isActive(href: string): boolean {
  if (href === '/') return route.path === '/'
  return route.path.startsWith(href)
}

function navigate(href: string) {
  router.push(href)
}
</script>

<template>
  <aside
    class="w-56 shrink-0 border-r h-screen sticky top-0 overflow-y-auto"
    style="border-color: var(--border); background-color: var(--surface)"
  >
    <div
      class="flex items-center gap-2 h-14 px-4"
      style="border-bottom: 1px solid var(--border)"
    >
      <el-icon :size="20" color="var(--accent)">
        <Monitor />
      </el-icon>
      <span class="font-semibold text-sm" style="color: var(--foreground)">Nexus AI</span>
    </div>
    <nav class="p-3 flex flex-col gap-0.5">
      <button
        v-for="item in navItems"
        :key="item.href"
        class="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors text-left w-full"
        :class="
          isActive(item.href)
            ? 'bg-accent/10 text-accent'
            : 'text-foreground/60 hover:bg-surface-secondary hover:text-foreground'
        "
        @click="navigate(item.href)"
      >
        <el-icon :size="16">
          <component :is="item.icon" />
        </el-icon>
        {{ item.label }}
      </button>
    </nav>
  </aside>
</template>
```

- [ ] **Step 2: 创建 ThemeSwitcher.vue**

Write `apps/web-v2/src/components/layout/ThemeSwitcher.vue`:

```vue
<script setup lang="ts">
import { useThemeStore } from '@/stores/theme'
import { Sunny, Moon } from '@element-plus/icons-vue'

const themeStore = useThemeStore()
</script>

<template>
  <button
    class="flex items-center justify-center w-8 h-8 rounded-lg hover:bg-surface-secondary transition-colors"
    @click="themeStore.toggle()"
  >
    <el-icon :size="16" v-if="themeStore.theme === 'light'">
      <Sunny />
    </el-icon>
    <el-icon :size="16" v-else>
      <Moon />
    </el-icon>
  </button>
</template>
```

- [ ] **Step 3: 创建 AppHeader.vue**

Write `apps/web-v2/src/components/layout/AppHeader.vue`:

```vue
<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Edit, SwitchButton, UserFilled } from '@element-plus/icons-vue'
import { useAuthStore } from '@/stores/auth'
import { useBreadcrumbStore } from '@/stores/breadcrumb'
import ThemeSwitcher from './ThemeSwitcher.vue'

const ROUTE_LABELS: Record<string, string> = {
  'knowledge-bases': '知识库',
  'ai-applications': 'AI 应用',
  chat: '对话',
  workflows: 'Workflow',
  models: '模型',
  tools: '工具',
  jobs: 'Job',
  settings: '设置',
  'audit-logs': '审计',
  login: '登录',
  register: '注册',
  'api-keys': 'API Keys',
  prompts: '提示词',
  documents: '文档',
  designer: '设计器',
}

const HIDDEN_BREADCRUMBS = new Set(['/login', '/register'])

function isDynamicId(segment: string): boolean {
  return (
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      segment,
    ) || /^\d+$/.test(segment)
  )
}

function buildBreadcrumbs(pathname: string, segmentLabels?: Record<string, string>) {
  const segments = pathname.split('/').filter(Boolean)
  if (segments.length === 0) return [{ href: '/', label: '仪表盘' }]

  const items: { href: string; label: string }[] = []
  let currentPath = ''

  for (const segment of segments) {
    currentPath += `/${segment}`
    const label =
      segmentLabels?.[segment] ??
      (isDynamicId(segment) ? '详情' : (ROUTE_LABELS[segment] ?? segment))
    items.push({ href: currentPath, label })
  }

  return items
}

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()
const breadcrumbStore = useBreadcrumbStore()

const breadcrumbs = computed(() =>
  buildBreadcrumbs(route.path, breadcrumbStore.segmentLabels),
)
const showBreadcrumbs = computed(() => !HIDDEN_BREADCRUMBS.has(route.path))

async function handleLogout() {
  await auth.logout()
  router.push('/login')
}
</script>

<template>
  <header
    class="h-14 shrink-0 flex items-center justify-between px-6"
    style="border-bottom: 1px solid var(--border); background-color: var(--surface)"
  >
    <div class="flex items-center gap-4">
      <el-breadcrumb v-if="showBreadcrumbs" separator="/">
        <el-breadcrumb-item
          v-for="(item, index) in breadcrumbs"
          :key="item.href"
          :to="index < breadcrumbs.length - 1 ? item.href : undefined"
        >
          {{ item.label }}
        </el-breadcrumb-item>
      </el-breadcrumb>
    </div>

    <div class="flex items-center gap-2">
      <ThemeSwitcher />

      <template v-if="auth.isLoading">
        <div class="h-5 w-20 rounded bg-surface-secondary animate-pulse" />
      </template>
      <template v-else-if="auth.isAuthenticated && auth.user">
        <el-dropdown trigger="click" @command="(cmd: string) => {
          if (cmd === 'logout') handleLogout()
        }">
          <span
            class="flex items-center gap-1.5 text-sm cursor-pointer outline-none"
            style="color: var(--foreground)"
          >
            <el-icon :size="16">
              <UserFilled />
            </el-icon>
            <span class="font-medium">{{ auth.user.username }}</span>
          </span>
          <template #dropdown>
            <el-dropdown-menu>
              <el-dropdown-item command="edit">
                <el-icon :size="14"><Edit /></el-icon>
                <span>编辑信息</span>
              </el-dropdown-item>
              <el-dropdown-item command="logout" divided>
                <el-icon :size="14"><SwitchButton /></el-icon>
                <span style="color: var(--el-color-danger)">退出登录</span>
              </el-dropdown-item>
            </el-dropdown-menu>
          </template>
        </el-dropdown>
      </template>
      <template v-else>
        <router-link
          to="/login"
          class="flex items-center gap-2 text-sm transition-colors"
          style="color: var(--foreground)"
        >
          <el-icon :size="20"><UserFilled /></el-icon>
          <span>登录</span>
        </router-link>
      </template>
    </div>
  </header>
</template>
```

- [ ] **Step 4: 创建 MainLayout.vue**

Write `apps/web-v2/src/layouts/MainLayout.vue`:

```vue
<script setup lang="ts">
import AppSidebar from '@/components/layout/AppSidebar.vue'
import AppHeader from '@/components/layout/AppHeader.vue'
</script>

<template>
  <div class="flex h-screen overflow-hidden">
    <AppSidebar />
    <div class="flex flex-1 flex-col overflow-hidden">
      <AppHeader />
      <main
        class="flex-1 overflow-y-auto p-6"
        style="background-color: var(--surface-secondary)"
      >
        <router-view />
      </main>
    </div>
  </div>
</template>
```

- [ ] **Step 5: 验证**

```bash
cd apps/web-v2 && npx vite --port 3034
```

验证：浏览器打开 `http://localhost:3034`，应看到完整布局（侧边栏 + Header + 仪表盘内容区域）。

- [ ] **Step 6: Commit**

```bash
git add apps/web-v2/src/layouts/ apps/web-v2/src/components/layout/
git commit -m "feat(web-v2): create layout components (sidebar, header, theme switcher)

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Phase 3: 认证页面 & 仪表盘

### Task 15: 创建登录页面（Login.vue）

**Files:**
- Create: `apps/web-v2/src/views/Login.vue`
- Create: `apps/web-v2/src/components/auth/AuthCard.vue`

- [ ] **Step 1: 创建 AuthCard.vue**

Write `apps/web-v2/src/components/auth/AuthCard.vue`:

```vue
<script setup lang="ts">
defineProps<{
  title: string
  subtitle?: string
}>()
</script>

<template>
  <div class="min-h-screen flex items-center justify-center p-4" style="background-color: var(--surface-secondary)">
    <div class="w-full max-w-md p-8 rounded-xl shadow-sm" style="background-color: var(--surface); border: 1px solid var(--border)">
      <div class="text-center mb-6">
        <h1 class="text-2xl font-bold" style="color: var(--foreground)">{{ title }}</h1>
        <p v-if="subtitle" class="text-sm mt-2" style="color: var(--foreground); opacity: 0.6">{{ subtitle }}</p>
      </div>
      <slot />
    </div>
  </div>
</template>
```

- [ ] **Step 2: 创建 Login.vue**

Write `apps/web-v2/src/views/Login.vue`:

```vue
<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { authApi, type CaptchaData } from '@/api/auth'
import { useAuthStore } from '@/stores/auth'
import { loginSchema, type LoginFormValues } from '@/validations/auth'
import AuthCard from '@/components/auth/AuthCard.vue'

const router = useRouter()
const route = useRoute()
const authStore = useAuthStore()

const form = reactive<LoginFormValues>({
  username: '',
  password: '',
  captchaCode: '',
})

const errors = reactive<Partial<Record<keyof LoginFormValues, string>>>({})
const captcha = ref<CaptchaData | null>(null)
const captchaLoading = ref(false)
const submitting = ref(false)
const serverError = ref('')

async function fetchCaptcha() {
  captchaLoading.value = true
  try {
    captcha.value = await authApi.getCaptcha()
  } catch {
    serverError.value = '获取验证码失败'
  } finally {
    captchaLoading.value = false
  }
}

async function handleSubmit() {
  errors.username = ''
  errors.password = ''
  errors.captchaCode = ''
  serverError.value = ''

  const result = loginSchema.safeParse(form)
  if (!result.success) {
    for (const issue of result.error.issues) {
      const field = issue.path[0] as keyof LoginFormValues
      errors[field] = issue.message
    }
    return
  }

  submitting.value = true
  try {
    const data = await authApi.login(
      form.username,
      form.password,
      captcha.value!.captchaId,
      form.captchaCode,
    )
    authStore.setUser(data)
    const redirect = (route.query.redirect as string) || '/'
    router.push(redirect)
  } catch (e) {
    serverError.value = e instanceof Error ? e.message : '登录失败'
    fetchCaptcha()
  } finally {
    submitting.value = false
  }
}

onMounted(() => {
  fetchCaptcha()
})
</script>

<template>
  <AuthCard title="登录" subtitle="Nexus AI Platform">
    <form class="flex flex-col gap-4" @submit.prevent="handleSubmit">
      <div>
        <el-input
          v-model="form.username"
          placeholder="用户名"
          :class="{ 'is-error': errors.username }"
        />
        <p v-if="errors.username" class="text-xs mt-1" style="color: var(--el-color-danger)">{{ errors.username }}</p>
      </div>

      <div>
        <el-input
          v-model="form.password"
          type="password"
          placeholder="密码"
          show-password
          :class="{ 'is-error': errors.password }"
        />
        <p v-if="errors.password" class="text-xs mt-1" style="color: var(--el-color-danger)">{{ errors.password }}</p>
      </div>

      <div>
        <div class="flex gap-2">
          <el-input
            v-model="form.captchaCode"
            placeholder="验证码"
            :class="{ 'is-error': errors.captchaCode }"
          />
          <div
            class="h-9 w-24 shrink-0 flex items-center justify-center rounded cursor-pointer"
            style="background-color: var(--surface-secondary)"
            @click="fetchCaptcha"
          >
            <span v-if="captchaLoading" class="text-xs">加载中...</span>
            <div v-else-if="captcha" v-html="captcha.svg" class="w-full h-full flex items-center justify-center" />
          </div>
        </div>
        <p v-if="errors.captchaCode" class="text-xs mt-1" style="color: var(--el-color-danger)">{{ errors.captchaCode }}</p>
      </div>

      <p v-if="serverError" class="text-sm text-center" style="color: var(--el-color-danger)">{{ serverError }}</p>

      <el-button type="primary" native-type="submit" :loading="submitting" class="w-full">
        登录
      </el-button>

      <p class="text-sm text-center" style="color: var(--foreground); opacity: 0.6">
        还没有账号？<router-link to="/register" class="font-medium" style="color: var(--accent)">立即注册</router-link>
      </p>
    </form>
  </AuthCard>
</template>
```

- [ ] **Step 3: Commit**

```bash
git add apps/web-v2/src/views/Login.vue apps/web-v2/src/components/auth/AuthCard.vue
git commit -m "feat(web-v2): implement login page with captcha and zod validation

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 16: 创建注册页面（Register.vue）

**Files:**
- Create: `apps/web-v2/src/views/Register.vue`

- [ ] **Step 1: 创建 Register.vue**

Write `apps/web-v2/src/views/Register.vue`:

```vue
<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { authApi, type CaptchaData } from '@/api/auth'
import { registerSchema, type RegisterFormValues } from '@/validations/auth'
import AuthCard from '@/components/auth/AuthCard.vue'

const router = useRouter()

const form = reactive<RegisterFormValues>({
  username: '',
  email: '',
  password: '',
  confirmPassword: '',
  captchaCode: '',
})

const errors = reactive<Partial<Record<keyof RegisterFormValues, string>>>({})
const captcha = ref<CaptchaData | null>(null)
const captchaLoading = ref(false)
const submitting = ref(false)
const serverError = ref('')

async function fetchCaptcha() {
  captchaLoading.value = true
  try {
    captcha.value = await authApi.getCaptcha()
  } catch {
    serverError.value = '获取验证码失败'
  } finally {
    captchaLoading.value = false
  }
}

async function handleSubmit() {
  errors.username = ''
  errors.email = ''
  errors.password = ''
  errors.confirmPassword = ''
  errors.captchaCode = ''
  serverError.value = ''

  const result = registerSchema.safeParse(form)
  if (!result.success) {
    for (const issue of result.error.issues) {
      const field = issue.path[0] as keyof RegisterFormValues
      if (!errors[field]) {
        errors[field] = issue.message
      }
    }
    return
  }

  submitting.value = true
  try {
    await authApi.register(
      form.username,
      form.email,
      form.password,
      captcha.value!.captchaId,
      form.captchaCode,
    )
    router.push('/login?registered=true')
  } catch (e) {
    serverError.value = e instanceof Error ? e.message : '注册失败'
    fetchCaptcha()
  } finally {
    submitting.value = false
  }
}

onMounted(() => {
  fetchCaptcha()
})
</script>

<template>
  <AuthCard title="注册" subtitle="创建你的 Nexus AI 账号">
    <form class="flex flex-col gap-4" @submit.prevent="handleSubmit">
      <div>
        <el-input v-model="form.username" placeholder="用户名" />
        <p v-if="errors.username" class="text-xs mt-1" style="color: var(--el-color-danger)">{{ errors.username }}</p>
      </div>

      <div>
        <el-input v-model="form.email" placeholder="邮箱" />
        <p v-if="errors.email" class="text-xs mt-1" style="color: var(--el-color-danger)">{{ errors.email }}</p>
      </div>

      <div>
        <el-input v-model="form.password" type="password" placeholder="密码" show-password />
        <p v-if="errors.password" class="text-xs mt-1" style="color: var(--el-color-danger)">{{ errors.password }}</p>
      </div>

      <div>
        <el-input v-model="form.confirmPassword" type="password" placeholder="确认密码" show-password />
        <p v-if="errors.confirmPassword" class="text-xs mt-1" style="color: var(--el-color-danger)">{{ errors.confirmPassword }}</p>
      </div>

      <div>
        <div class="flex gap-2">
          <el-input v-model="form.captchaCode" placeholder="验证码" />
          <div
            class="h-9 w-24 shrink-0 flex items-center justify-center rounded cursor-pointer"
            style="background-color: var(--surface-secondary)"
            @click="fetchCaptcha"
          >
            <span v-if="captchaLoading" class="text-xs">加载中...</span>
            <div v-else-if="captcha" v-html="captcha.svg" class="w-full h-full flex items-center justify-center" />
          </div>
        </div>
        <p v-if="errors.captchaCode" class="text-xs mt-1" style="color: var(--el-color-danger)">{{ errors.captchaCode }}</p>
      </div>

      <p v-if="serverError" class="text-sm text-center" style="color: var(--el-color-danger)">{{ serverError }}</p>

      <el-button type="primary" native-type="submit" :loading="submitting" class="w-full">
        注册
      </el-button>

      <p class="text-sm text-center" style="color: var(--foreground); opacity: 0.6">
        已有账号？<router-link to="/login" class="font-medium" style="color: var(--accent)">去登录</router-link>
      </p>
    </form>
  </AuthCard>
</template>
```

- [ ] **Step 2: Commit**

```bash
git add apps/web-v2/src/views/Register.vue
git commit -m "feat(web-v2): implement register page with zod validation

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 17: 创建仪表盘页面（Dashboard.vue）

**Files:**
- Modify: `apps/web-v2/src/views/Dashboard.vue`

- [ ] **Step 1: 重写 Dashboard.vue（替换占位实现）**

Write `apps/web-v2/src/views/Dashboard.vue`:

```vue
<template>
  <div>
    <h1 class="text-2xl font-semibold mb-6" style="color: var(--foreground)">平台概览</h1>

    <div class="grid grid-cols-3 gap-4 mb-8">
      <el-card v-for="stat in stats" :key="stat.label">
        <div class="text-center py-6">
          <div class="text-3xl font-bold" style="color: var(--foreground)">{{ stat.value }}</div>
          <div class="text-sm mt-1" style="color: var(--foreground); opacity: 0.6">{{ stat.label }}</div>
        </div>
      </el-card>
    </div>

    <el-card>
      <template #header>
        <h2 class="text-base font-semibold" style="color: var(--foreground)">最近对话</h2>
      </template>
      <p class="text-sm" style="color: var(--foreground); opacity: 0.6">暂无对话记录</p>
    </el-card>
  </div>
</template>

<script setup lang="ts">
const stats = [
  { label: '知识库', value: 3 },
  { label: '文档', value: 12 },
  { label: 'Chunks', value: 156 },
  { label: 'AI 应用', value: 5 },
  { label: '模型', value: 8 },
  { label: '工具', value: 2 },
]
</script>
```

- [ ] **Step 2: Commit**

```bash
git add apps/web-v2/src/views/Dashboard.vue
git commit -m "feat(web-v2): implement dashboard page with stat cards

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Phase 4: 业务页面（知识库、文档、AI 应用、对话）

### Task 18-25 概览

后续 Tasks 18-35 按相同模式迁移剩余页面。每页遵循统一模式：

1. 创建 API 模块 (`api/<domain>.ts`) — CRUD 函数
2. 创建 TanStack Query composable (`composables/use-<domain>.ts`)
3. 创建页面组件 (`views/<Page>.vue`) — 使用 Element Plus 组件
4. 如有子组件 → 创建对应 `components/<domain>/<Component>.vue`

以下为剩余页面的精简实现计划，每个页面为一个 Task。

---

### Task 18: 知识库列表页 + API

**Files:**
- Create: `apps/web-v2/src/api/knowledge-bases.ts`
- Create: `apps/web-v2/src/composables/use-knowledge-bases.ts`
- Create: `apps/web-v2/src/views/KnowledgeBases.vue`
- Create: `apps/web-v2/src/components/knowledge-bases/KbCard.vue`
- Create: `apps/web-v2/src/components/knowledge-bases/KbCreateDialog.vue`

**Step 1: api/knowledge-bases.ts**

```typescript
import http from './client'

export const knowledgeBasesApi = {
  list: (params?: Record<string, unknown>) => http.get('/api/v1/knowledge-bases', { params }),
  get: (id: string) => http.get(`/api/v1/knowledge-bases/${id}`),
  create: (data: unknown) => http.post('/api/v1/knowledge-bases', data),
  update: (id: string, data: unknown) => http.patch(`/api/v1/knowledge-bases/${id}`, data),
  delete: (id: string) => http.delete(`/api/v1/knowledge-bases/${id}`),
}
```

**Step 2: composables/use-knowledge-bases.ts**

```typescript
import { useQuery, useMutation, useQueryClient } from '@tanstack/vue-query'
import { toValue, type MaybeRef } from 'vue'
import { knowledgeBasesApi } from '@/api/knowledge-bases'

export function useKnowledgeBases() {
  return useQuery({
    queryKey: ['knowledge-bases'],
    queryFn: () => knowledgeBasesApi.list(),
  })
}

export function useKnowledgeBase(id: MaybeRef<string>) {
  return useQuery({
    queryKey: ['knowledge-bases', id],
    queryFn: () => knowledgeBasesApi.get(toValue(id)),
    enabled: () => !!toValue(id),
  })
}

export function useCreateKnowledgeBase() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: knowledgeBasesApi.create,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['knowledge-bases'] }),
  })
}

export function useDeleteKnowledgeBase() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: knowledgeBasesApi.delete,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['knowledge-bases'] }),
  })
}
```

**Step 3: components/knowledge-bases/KbCard.vue**

```vue
<script setup lang="ts">
import { Delete, Edit, View } from '@element-plus/icons-vue'

defineProps<{
  id: string
  name: string
  description?: string
  documentCount?: number
  createdAt?: string
}>()

const emit = defineEmits<{
  view: [id: string]
  edit: [id: string]
  delete: [id: string]
}>()
</script>

<template>
  <el-card shadow="hover" class="cursor-pointer">
    <div class="flex items-start justify-between mb-2">
      <h3 class="font-semibold text-base" style="color: var(--foreground)">{{ name }}</h3>
      <div class="flex gap-1">
        <el-button :icon="View" size="small" text @click="emit('view', id)" />
        <el-button :icon="Edit" size="small" text @click="emit('edit', id)" />
        <el-button :icon="Delete" size="small" text @click="emit('delete', id)" />
      </div>
    </div>
    <p v-if="description" class="text-sm mb-3" style="color: var(--foreground); opacity: 0.6">{{ description }}</p>
    <div class="flex gap-4 text-xs" style="color: var(--foreground); opacity: 0.6">
      <span v-if="documentCount !== undefined">{{ documentCount }} 个文档</span>
      <span v-if="createdAt">{{ createdAt }}</span>
    </div>
  </el-card>
</template>
```

**Step 4: components/knowledge-bases/KbCreateDialog.vue**

```vue
<script setup lang="ts">
import { reactive, ref } from 'vue'
import { useCreateKnowledgeBase } from '@/composables/use-knowledge-bases'
import type { ElDialog } from 'element-plus'

const visible = defineModel<boolean>('visible', { default: false })

const form = reactive({
  name: '',
  description: '',
})

const createMutation = useCreateKnowledgeBase()
const submitting = ref(false)

async function handleSubmit() {
  submitting.value = true
  try {
    await createMutation.mutateAsync(form)
    visible.value = false
    form.name = ''
    form.description = ''
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <el-dialog v-model="visible" title="创建知识库" width="480px">
    <el-form @submit.prevent="handleSubmit">
      <el-form-item label="名称" required>
        <el-input v-model="form.name" placeholder="知识库名称" />
      </el-form-item>
      <el-form-item label="描述">
        <el-input v-model="form.description" type="textarea" placeholder="知识库描述（可选）" />
      </el-form-item>
    </el-form>
    <template #footer>
      <el-button @click="visible = false">取消</el-button>
      <el-button type="primary" :loading="submitting" @click="handleSubmit">创建</el-button>
    </template>
  </el-dialog>
</template>
```

**Step 5: views/KnowledgeBases.vue**

```vue
<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { Plus } from '@element-plus/icons-vue'
import { useKnowledgeBases, useDeleteKnowledgeBase } from '@/composables/use-knowledge-bases'
import KbCard from '@/components/knowledge-bases/KbCard.vue'
import KbCreateDialog from '@/components/knowledge-bases/KbCreateDialog.vue'

const router = useRouter()
const { data: kbs, isLoading } = useKnowledgeBases()
const deleteMutation = useDeleteKnowledgeBase()

const createDialogVisible = ref(false)

function handleView(id: string) { router.push(`/knowledge-bases/${id}`) }
function handleEdit(id: string) { router.push(`/knowledge-bases/${id}`) }
function handleDelete(id: string) { deleteMutation.mutate(id) }
</script>

<template>
  <div>
    <div class="flex items-center justify-between mb-6">
      <h1 class="text-2xl font-semibold" style="color: var(--foreground)">知识库</h1>
      <el-button type="primary" :icon="Plus" @click="createDialogVisible = true">创建知识库</el-button>
    </div>

    <div v-if="isLoading" class="flex justify-center py-12">
      <el-icon class="is-loading" :size="24"><Plus /></el-icon>
    </div>

    <div v-else-if="kbs && (kbs as unknown[]).length > 0" class="grid grid-cols-3 gap-4">
      <KbCard
        v-for="kb in (kbs as unknown[])"
        :key="(kb as Record<string,string>).id"
        v-bind="kb as Record<string,unknown>"
        @view="handleView"
        @edit="handleEdit"
        @delete="handleDelete"
      />
    </div>

    <el-empty v-else description="暂无知识库" />

    <KbCreateDialog v-model:visible="createDialogVisible" />
  </div>
</template>
```

**Step 6: Commit**

```bash
git add apps/web-v2/src/api/knowledge-bases.ts \
        apps/web-v2/src/composables/use-knowledge-bases.ts \
        apps/web-v2/src/views/KnowledgeBases.vue \
        apps/web-v2/src/components/knowledge-bases/
git commit -m "feat(web-v2): implement knowledge bases list page with CRUD

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 19: 知识库详情页

**Files:**
- Create: `apps/web-v2/src/views/KnowledgeBaseDetail.vue`
- Create: `apps/web-v2/src/components/knowledge-bases/KbPermission.vue`
- Create: `apps/web-v2/src/components/knowledge-bases/UploadDocumentsModal.vue`

**Steps:** 参照 Task 18 模式：
- 使用 `useKnowledgeBase(id)` composable 获取详情
- `KbPermission.vue` — 权限配置表单（el-form + el-switch）
- `UploadDocumentsModal.vue` — el-upload + el-dialog
- 页面内嵌套 `<el-tabs>` 切换 "文档"/"设置"/"权限"

**Commit:**
```bash
git add apps/web-v2/src/views/KnowledgeBaseDetail.vue \
        apps/web-v2/src/components/knowledge-bases/KbPermission.vue \
        apps/web-v2/src/components/knowledge-bases/UploadDocumentsModal.vue
git commit -m "feat(web-v2): implement knowledge base detail page

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 20: 文档列表页

**Files:**
- Create: `apps/web-v2/src/api/documents.ts`
- Create: `apps/web-v2/src/composables/use-documents.ts`
- Create: `apps/web-v2/src/views/Documents.vue`
- Create: `apps/web-v2/src/components/documents/DocumentTable.vue`
- Create: `apps/web-v2/src/components/documents/DocumentUpload.vue`
- Create: `apps/web-v2/src/components/documents/DocumentActions.vue`

**Steps:** 
- `api/documents.ts` — CRUD（参照原 `apps/web/src/lib/api/documents.ts`）
- `composables/use-documents.ts` — TanStack Query 封装
- `DocumentTable.vue` — `<el-table>` 展示文档列表
- `DocumentUpload.vue` — `<el-upload>` 组件
- `DocumentActions.vue` — 下载/删除等操作按钮
- `Documents.vue` — 组合以上组件

**Commit:**
```bash
git add apps/web-v2/src/api/documents.ts \
        apps/web-v2/src/composables/use-documents.ts \
        apps/web-v2/src/views/Documents.vue \
        apps/web-v2/src/components/documents/
git commit -m "feat(web-v2): implement documents list page

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 21: 文档详情页

**Files:**
- Create: `apps/web-v2/src/views/DocumentDetail.vue`
- Create: `apps/web-v2/src/api/chunks.ts`
- Create: `apps/web-v2/src/composables/use-chunks.ts`
- Create: `apps/web-v2/src/components/documents/ChunkList.vue`
- Create: `apps/web-v2/src/components/documents/VersionHistory.vue`

**Steps:**
- `api/chunks.ts` — chunks API
- `composables/use-chunks.ts` — TanStack Query 封装
- `ChunkList.vue` — `<el-table>` 展示文档分段
- `VersionHistory.vue` — `<el-timeline>` 展示版本历史
- `DocumentDetail.vue` — `<el-tabs>` 切换 "内容"/"分段"/"版本"

**Commit:**
```bash
git add apps/web-v2/src/views/DocumentDetail.vue \
        apps/web-v2/src/api/chunks.ts \
        apps/web-v2/src/composables/use-chunks.ts \
        apps/web-v2/src/components/documents/ChunkList.vue \
        apps/web-v2/src/components/documents/VersionHistory.vue
git commit -m "feat(web-v2): implement document detail page with chunks and versions

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 22: AI 应用列表页 + 详情页

**Files:**
- Create: `apps/web-v2/src/api/ai-applications.ts`
- Create: `apps/web-v2/src/composables/use-ai-applications.ts`
- Create: `apps/web-v2/src/views/AiApplications.vue`
- Create: `apps/web-v2/src/views/AiApplicationDetail.vue`
- Create: `apps/web-v2/src/components/ai-applications/AppCard.vue`
- Create: `apps/web-v2/src/components/ai-applications/AppCreateDialog.vue`
- Create: `apps/web-v2/src/components/ai-applications/AppConfig.vue`

**Steps:** 参照 Task 18 模式。

**Commit:**
```bash
git add apps/web-v2/src/api/ai-applications.ts \
        apps/web-v2/src/composables/use-ai-applications.ts \
        apps/web-v2/src/views/AiApplications.vue \
        apps/web-v2/src/views/AiApplicationDetail.vue \
        apps/web-v2/src/components/ai-applications/
git commit -m "feat(web-v2): implement AI applications list and detail pages

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 23: 对话页面

**Files:**
- Create: `apps/web-v2/src/api/chat.ts`
- Create: `apps/web-v2/src/composables/use-chat.ts`
- Create: `apps/web-v2/src/views/Chat.vue`
- Create: `apps/web-v2/src/views/ChatSession.vue`
- Create: `apps/web-v2/src/components/chat/ChatSessionList.vue`
- Create: `apps/web-v2/src/components/chat/ChatMessage.vue`
- Create: `apps/web-v2/src/components/chat/ChatInput.vue`
- Create: `apps/web-v2/src/components/chat/CitationCard.vue`

**Steps:**
- `Chat.vue` — 左侧 `<ChatSessionList>` + 中间空状态 `"请选择一个对话"`
- `ChatSession.vue` — 左侧会话列表 + 右侧聊天区（`ChatMessage` + `ChatInput`）
- `ChatSessionList.vue` — `<el-menu>` 列表
- `ChatMessage.vue` — 消息气泡（用户/AI，支持 Markdown 渲染）
- `ChatInput.vue` — `<el-input>` + 发送按钮
- `CitationCard.vue` — 引用来源卡片

**Commit:**
```bash
git add apps/web-v2/src/api/chat.ts \
        apps/web-v2/src/composables/use-chat.ts \
        apps/web-v2/src/views/Chat.vue \
        apps/web-v2/src/views/ChatSession.vue \
        apps/web-v2/src/components/chat/
git commit -m "feat(web-v2): implement chat pages with session list and messaging

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Phase 5: 功能页面（Workflows、Models、Tools、Jobs）

### Task 24: Workflows 列表页 + 详情页

**Files:**
- Create: `apps/web-v2/src/api/workflows.ts`
- Create: `apps/web-v2/src/composables/use-workflows.ts`
- Create: `apps/web-v2/src/views/Workflows.vue`
- Create: `apps/web-v2/src/views/WorkflowDetail.vue`
- Create: `apps/web-v2/src/components/workflows/WorkflowCard.vue`
- Create: `apps/web-v2/src/components/workflows/WorkflowConfig.vue`
- Create: `apps/web-v2/src/components/workflows/ExecutionList.vue`

**Commit:**
```bash
git add apps/web-v2/src/api/workflows.ts \
        apps/web-v2/src/composables/use-workflows.ts \
        apps/web-v2/src/views/Workflows.vue \
        apps/web-v2/src/views/WorkflowDetail.vue \
        apps/web-v2/src/components/workflows/
git commit -m "feat(web-v2): implement workflows list and detail pages

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 25: Workflow Designer 页面

**Files:**
- Create: `apps/web-v2/src/views/WorkflowDesigner.vue`

**Steps:**
- 集成 `@vue-flow/core` + `@vue-flow/background` + `@vue-flow/controls`
- 左侧节点面板（el-card + 可拖拽节点）
- 中间 Vue Flow 画布
- 右侧节点配置面板（el-form）
- Monaco Editor 用于代码编辑节点（动态 import `monaco-editor`）

```vue
<script setup lang="ts">
import { ref, shallowRef } from 'vue'
import { VueFlow } from '@vue-flow/core'
import { Background } from '@vue-flow/background'
import { Controls } from '@vue-flow/controls'
import '@vue-flow/core/dist/style.css'
import '@vue-flow/core/dist/theme-default.css'

const nodes = ref([])
const edges = ref([])
</script>
```

**Commit:**
```bash
git add apps/web-v2/src/views/WorkflowDesigner.vue
git commit -m "feat(web-v2): implement workflow designer with vue-flow and monaco editor

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 26: Models 页面

**Files:**
- Create: `apps/web-v2/src/api/models.ts`
- Create: `apps/web-v2/src/composables/use-models.ts`
- Create: `apps/web-v2/src/views/Models.vue`
- Create: `apps/web-v2/src/components/models/ModelCard.vue`
- Create: `apps/web-v2/src/components/models/ModelForm.vue`

**Commit:**
```bash
git add apps/web-v2/src/api/models.ts \
        apps/web-v2/src/composables/use-models.ts \
        apps/web-v2/src/views/Models.vue \
        apps/web-v2/src/components/models/
git commit -m "feat(web-v2): implement models page with CRUD

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 27: Tools 页面

**Files:**
- Create: `apps/web-v2/src/api/tools.ts`
- Create: `apps/web-v2/src/composables/use-tools.ts`
- Create: `apps/web-v2/src/views/Tools.vue`
- Create: `apps/web-v2/src/components/tools/ToolCard.vue`
- Create: `apps/web-v2/src/components/tools/ToolForm.vue`

**Commit:**
```bash
git add apps/web-v2/src/api/tools.ts \
        apps/web-v2/src/composables/use-tools.ts \
        apps/web-v2/src/views/Tools.vue \
        apps/web-v2/src/components/tools/
git commit -m "feat(web-v2): implement tools page with CRUD

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 28: Jobs 页面

**Files:**
- Create: `apps/web-v2/src/api/jobs.ts`
- Create: `apps/web-v2/src/composables/use-jobs.ts`
- Create: `apps/web-v2/src/views/Jobs.vue`
- Create: `apps/web-v2/src/components/jobs/JobTable.vue`
- Create: `apps/web-v2/src/components/jobs/JobProgress.vue`

**Steps:**
- `JobTable.vue` — `<el-table>` + `<el-pagination>`
- `JobProgress.vue` — `<el-progress>` + `<el-tag>` 状态标签

**Commit:**
```bash
git add apps/web-v2/src/api/jobs.ts \
        apps/web-v2/src/composables/use-jobs.ts \
        apps/web-v2/src/views/Jobs.vue \
        apps/web-v2/src/components/jobs/
git commit -m "feat(web-v2): implement jobs page with progress tracking

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Phase 6: 设置 & 审计 & 收尾

### Task 29: Settings + API Keys 页面

**Files:**
- Create: `apps/web-v2/src/api/settings.ts`
- Create: `apps/web-v2/src/api/api-keys.ts`
- Create: `apps/web-v2/src/composables/use-settings.ts`
- Create: `apps/web-v2/src/views/Settings.vue`
- Create: `apps/web-v2/src/views/ApiKeys.vue`
- Create: `apps/web-v2/src/components/settings/ApiKeyForm.vue`
- Create: `apps/web-v2/src/components/settings/RetrieverConfig.vue`
- Create: `apps/web-v2/src/components/settings/EmbeddingSelect.vue`
- Create: `apps/web-v2/src/components/settings/ChunkConfig.vue`

**Commit:**
```bash
git add apps/web-v2/src/api/settings.ts apps/web-v2/src/api/api-keys.ts \
        apps/web-v2/src/composables/use-settings.ts \
        apps/web-v2/src/views/Settings.vue apps/web-v2/src/views/ApiKeys.vue \
        apps/web-v2/src/components/settings/
git commit -m "feat(web-v2): implement settings and api keys pages

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 30: Prompts 页面

**Files:**
- Create: `apps/web-v2/src/api/prompts.ts`
- Create: `apps/web-v2/src/composables/use-prompts.ts`
- Create: `apps/web-v2/src/views/Prompts.vue`
- Create: `apps/web-v2/src/components/prompts/PromptEditor.vue`
- Create: `apps/web-v2/src/components/prompts/PromptVersion.vue`

**Steps:**
- `PromptEditor.vue` — `<el-input type="textarea">` 或 Monaco Editor（动态 import）
- `PromptVersion.vue` — `<el-timeline>` 展示版本历史

**Commit:**
```bash
git add apps/web-v2/src/api/prompts.ts \
        apps/web-v2/src/composables/use-prompts.ts \
        apps/web-v2/src/views/Prompts.vue \
        apps/web-v2/src/components/prompts/
git commit -m "feat(web-v2): implement prompts page with editor and versions

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 31: Audit Logs 页面

**Files:**
- Create: `apps/web-v2/src/api/audit-logs.ts`
- Create: `apps/web-v2/src/views/AuditLogs.vue`
- Create: `apps/web-v2/src/components/audit/AuditLogTable.vue`

**Steps:**
- `AuditLogTable.vue` — `<el-table>` + `<el-pagination>` + `<el-tag>` 操作类型

**Commit:**
```bash
git add apps/web-v2/src/api/audit-logs.ts \
        apps/web-v2/src/views/AuditLogs.vue \
        apps/web-v2/src/components/audit/
git commit -m "feat(web-v2): implement audit logs page

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Phase 7: 收尾

### Task 32: Docker 配置

**Files:**
- Modify: `docker/web.Dockerfile`
- Create: `apps/web-v2/nginx.conf`

- [ ] **Step 1: 创建 Dockerfile**

Write `docker/web.Dockerfile`:

```dockerfile
FROM node:22-alpine AS builder
WORKDIR /app
COPY . .
RUN corepack enable && pnpm install --frozen-lockfile
RUN pnpm turbo run build --filter=@nexus/web-v2

FROM nginx:alpine
COPY --from=builder /app/apps/web-v2/dist /usr/share/nginx/html
COPY apps/web-v2/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

- [ ] **Step 2: 创建 nginx.conf**

Write `apps/web-v2/nginx.conf`:

```nginx
server {
    listen 80;
    server_name localhost;
    root /usr/share/nginx/html;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    location /api/ {
        proxy_pass http://api:3000/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

- [ ] **Step 3: Commit**

```bash
git add docker/web.Dockerfile apps/web-v2/nginx.conf
git commit -m "feat(web-v2): add docker and nginx configuration

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 33: README 文档

**Files:**
- Create: `apps/web-v2/README.md`

- [ ] **Step 1: 创建 README.md**

Write `apps/web-v2/README.md`:

```markdown
# @nexus/web-v2

Nexus AI Platform — Vue 3 前端项目。

## 技术栈

- **框架**: Vue 3 + TypeScript + Vite 6
- **UI**: Element Plus + Tailwind CSS 4
- **状态**: Pinia + TanStack Query Vue 5
- **路由**: Vue Router 4
- **HTTP**: Axios
- **校验**: Zod

## 快速开始

```bash
pnpm install
pnpm dev
```

开发服务器运行在 http://localhost:3034，API 代理到 http://localhost:3000。

## 构建

```bash
pnpm build
```

输出目录: `dist/`

## 目录结构

```
src/
├── api/          # Axios HTTP 客户端与 API 函数
├── stores/       # Pinia 状态管理
├── composables/  # VueUse + TanStack Query 可组合函数
├── types/        # TypeScript 类型定义
├── validations/  # Zod 校验 schema
├── utils/        # 工具函数
├── router/       # Vue Router 配置
├── layouts/      # 布局组件
├── components/   # 公共组件
├── views/        # 页面组件
└── styles/       # 全局样式
```
```

- [ ] **Step 2: Commit**

```bash
git add apps/web-v2/README.md
git commit -m "docs(web-v2): add README with tech stack and project structure

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## 依赖关系

```
Phase 1 (Task 1-7)     工程骨架 ──────────────────────── 所有后续依赖
Phase 2 (Task 8-14)    基础设施 ──────────────────────── Phase 3-6 依赖
Phase 3 (Task 15-17)   认证 + 仪表盘 ─────────────────── 独立，可并行
Phase 4 (Task 18-23)   业务页面（KB/Docs/AI/Chat）────── 逐个独立，可并行
Phase 5 (Task 24-28)   功能页面（Workflows/Models/Tools/Jobs）── 独立，可并行
Phase 6 (Task 29-31)   设置 & 审计 ───────────────────── 独立，可并行
Phase 7 (Task 32-33)   收尾 ──────────────────────────── Phase 1-6 全部完成后
```

**Phase 3-6 可在 Phase 2 完成后并行进行。**

---

## 配置变更汇总

| 文件 | 操作 | Task |
|------|------|------|
| `apps/web-v2/` (全部) | 新增 | 1-33 |
| `turbo.json:5` | 修改 outputs | 7 |
| `docker/web.Dockerfile` | 重写 | 32 |
| `pnpm-lock.yaml` | 自动更新 | 1 (pnpm install) |
