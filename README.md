# Nexus AI Platform

A full-stack enterprise AI platform featuring Knowledge Base, RAG, Workflow, Multi-Agent, and AI Application Management.

## 项目结构

```
nexus-ai-platform/
├── apps/
│   ├── api/        # NestJS 后端 API 服务
│   ├── web/        # Next.js 前端应用
│   └── worker/     # BullMQ 后台任务 Worker
└── packages/       # 共享工具包
```

## 技术栈

| 应用 | 框架 | 说明 |
|------|------|------|
| `apps/api` | NestJS 11 | REST API 服务 |
| `apps/web` | Next.js 16 | 前端 Web 应用 |
| `apps/worker` | BullMQ + TypeScript | 后台任务处理 |

## 快速开始

### 环境要求

- Node.js >= 18
- pnpm >= 9
- Docker（用于本地基础设施）

### 安装依赖

```bash
pnpm install
```

### 启动基础设施

```bash
# 一键启动 PostgreSQL + Redis + MinIO
docker compose up -d

# 停止
docker compose down

# 停止并清除数据
docker compose down -v
```

服务端口：

| 服务 | 端口 | 控制台 |
|------|------|--------|
| PostgreSQL | 5432 | — |
| Redis | 6379 | — |
| MinIO | 9000 | http://localhost:9001 |

### 环境变量

```bash
cp .env.example .env
```

### 开发

```bash
# 启动所有应用（开发模式）
pnpm dev

# 单独启动某个应用
pnpm --filter @nexus/web dev
pnpm --filter @nexus/api start:dev
pnpm --filter @nexus/worker dev
```

### 构建

```bash
pnpm build
```

### 代码检查

```bash
pnpm lint
pnpm check-types
```
