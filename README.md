# Nexus AI Platform

A full-stack enterprise AI platform featuring Knowledge Base, RAG, Workflow, Multi-Agent, and AI Application Management.

## 项目结构

```
nexus-ai-platform/
├── apps/
│   ├── api/        # @nexus/api       NestJS 后端 API 服务
│   ├── web/        # @nexus/web-v2    Vue + Vite 前端应用
│   └── worker/     # @nexus/worker    BullMQ 后台任务 Worker
└── packages/       # 共享 workspace 包（app 通过包名导入，消费 dist 产物）
    ├── database/   # @nexus/database   Prisma 数据库封装
    ├── shared/     # @nexus/shared     队列常量 / Redis / MinIO 公共基础设施
    ├── ai-core/    # @nexus/ai-core    Embedding / ModelProvider AI 核心
    └── config/     # 预留目录（rag / ui 等暂未启用）
```

## 技术栈

| 应用 | 框架 | 说明 |
|------|------|------|
| `apps/api` | NestJS 11 | REST API 服务 |
| `apps/web` | Vue 3 + Vite | 前端 Web 应用 |
| `apps/worker` | BullMQ + TypeScript | 后台任务处理 |

| 共享包 | 依赖 | 说明 |
|--------|------|------|
| `packages/database` | @prisma/client, @prisma/adapter-pg | Prisma 数据库封装（`PrismaService` / `PrismaModule`） |
| `packages/shared` | ioredis, minio | 队列常量、Redis、MinIO 等公共基础设施 |
| `packages/ai-core` | @nexus/shared | Embedding、ModelProvider 等 AI 核心模块 |

依赖关系：仅 `@nexus/ai-core` 依赖 `@nexus/shared`，三者均被 `apps/api` 与 `apps/worker` 消费。

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
pnpm --filter @nexus/api dev
pnpm --filter @nexus/worker dev
```

> **共享包 watch 构建**：`pnpm dev` 通过 turbo 并行运行所有 `packages/*` 的 `tsc --watch` 与各 app 的 `nest start --watch`。
> 修改 `packages/*/src` 后**无需手动 rebuild**：包 watch 自动重编译 `dist`，app watch 检测到依赖声明文件变化后自动重启。

#### 共享包（packages）开发

`apps/api` 与 `apps/worker` 通过**包名**导入共享包，运行时消费包构建产物 `dist/`：

```ts
import { PrismaModule, PrismaService } from '@nexus/database';
import { RedisService, MinioService, QUEUE_NAMES } from '@nexus/shared';
import { EmbeddingService, ModelProviderService } from '@nexus/ai-core';
```

注意事项：

- **为什么用包名而非相对路径**：`packages/` 位于各 app 的 `rootDir` 之外，Nest 编译（`TS6059`）与工程实践都不允许跨 app 用相对路径引用；包名导入建立了清晰的依赖图（turbo 依赖构建顺序）。
- **为什么消费 `dist/` 而非源码**：Node 24 原生 type-stripping 无法解析包内无扩展名 / `.js` 后缀的相对导入（报 `ERR_MODULE_NOT_FOUND`），故 `main` / `types` / `exports` 均指向 `dist/index.js` 与 `dist/index.d.ts`。
- 包源码内部相对导入统一使用 `.js` 后缀（`moduleResolution: nodenext` 规范）。
- 各包导出统一收敛在入口 `src/index.ts`（barrel），app 只能从入口取用，无法 deep-import 内部实现。
- 单独重新构建某个包（watch 未运行时）：

```bash
pnpm --filter @nexus/shared run build
```

### 数据库操作

```bash
# ========== Prisma 开发常用 ==========
pnpm prisma:gen                  # prisma generate
pnpm prisma:migrate              # prisma migrate dev
pnpm prisma:migrate:init         # prisma migrate dev --name init

# 开发新增字段统一规范调用（带备注）
pnpm db:new                      # prisma migrate dev --name

# 重置本地库（清空表+重新执行所有迁移+seed，本地调试用）
pnpm db:reset                    # prisma migrate reset

# ========== 生产环境安全部署 ==========
pnpm prisma:deploy               # prisma migrate deploy

# ========== 辅助工具 ==========
# 打开 Prisma Studio 可视化数据库
pnpm db:studio                   # prisma studio
# 拉取现有数据库反向生成 schema（已有老库接管场景）
pnpm prisma:pull                 # prisma db pull
# 执行 seed 填充初始数据
pnpm prisma:seed                 # prisma db seed
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
