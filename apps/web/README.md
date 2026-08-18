# @nexus/web

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

## Docker

```bash
docker build -f docker/web.Dockerfile -t nexus-web-v2 .
docker run -p 8080:80 nexus-web-v2
```

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

## 与原项目 (apps/web) 的关系

本项目是原 Next.js + HeroUI 前端 (`apps/web`) 的 Vue 3 重写版本。
所有页面和功能 1:1 对应，API 接口完全兼容。
