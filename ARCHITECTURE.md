# NexusAI Platform — 项目架构设计

---

## 1. 整体拓扑 (含 Event Bus)

```
┌──────────────────────────────────────────────────────────────────┐
│                       前端 (Frontend)                             │
│              Vue 3 + Vite + Element Plus + Pinia                │
│                                                                  │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌────────┐  │
│  │Knowledge │ │Document  │ │Document  │ │Index Job │ │System  │  │
│  │Base List │ │List      │ │Detail    │ │Monitor   │ │Setting │  │
│  └────┬─────┘ └────┬─────┘ └────┬─────┘ └────┬─────┘ └───┬────┘  │
│       │            │            │            │           │       │
│  ┌────┴────────────┴────────────┴────────────┴───────────┴────┐  │
│  │  Chat (RAG)  │  AI Apps   │  Workflow   │  Model    │ Tool │  │
│  │              │  Center    │  Engine     │  Center   │Center│  │
│  └──────────────┴────────────┴─────────────┴───────────┴──────┘  │
│  │  Prompt Template  │  Audit Log  │  API Key  │  Dashboard  │   │
│  └───────────────────┴─────────────┴───────────┴─────────────┘   │
│                            │  HTTP/REST                          │
└────────────────────────────┼─────────────────────────────────────┘
                             │
┌────────────────────────────┼─────────────────────────────────────┐
│                   后端 (Backend)                                  │
│                NestJS + TypeScript                               │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐    │
│  │                      API Gateway                         │    │
│  │  /api/v1/knowledge-bases  /api/v1/documents  /api/v1/... │    │
│  └──────────────────────────────┬───────────────────────────┘    │
│                                 │                                │
│  ┌──────────┐ ┌──────────┐ ┌───┴──────┐ ┌──────────┐ ┌───────┐   │
│  │Auth      │ │Knowledge │ │Document  │ │Embedding │ │Retrie-│   │
│  │Module    │ │Base      │ │Module    │ │Module    │ │val    │   │
│  └────┬─────┘ └────┬─────┘ └────┬─────┘ └────┬─────┘ └───┬───┘   │
│       │            │            │            │           │       │
│  ┌────┴─────┐ ┌────┴─────┐ ┌────┴─────┐ ┌────┴─────┐ ┌───┴───┐   │
│  │User      │ │Permission│ │Chunk     │ │LangChain │ │Chat   │   │
│  │Module    │ │Module    │ │Module    │ │Integr.   │ │Module │   │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘ └───────┘   │
│                                                                  │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌────────────────────┐   │
│  │Prompt    │ │Audit     │ │API Key   │ │Workflow            │   │
│  │Template  │ │Log       │ │Module    │ │Module              │   │
│  └──────────┘ └──────────┘ └──────────┘ └────────────────────┘   │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐    │
│  │                 AI Application Layer                     │    │
│  │  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐      │    │
│  │  │ AI App       │ │ Model        │ │ Tool         │      │    │
│  │  │ Service      │ │ Service      │ │ Service      │      │    │
│  │  │ (编排层)      │ │ (模型注册)    │ │ (工具注册)    │       │    │
│  │  └──────────────┘ └──────────────┘ └──────────────┘      │    │
│  └──────────────────────────────────────────────────────────┘    │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐    │
│  │        Retrieval Pipeline (Query 侧, Hybrid Search)      │    │
│  │  SparseRetriever(BM25) + DenseRetriever(Vector)          │    │
│  │        ↕ RRF Fusion ↕                                    │    │
│  │  Reranker → Citation → Prompt → LLM (SSE Streaming)      │    │
│  └──────────────────────────────────────────────────────────┘    │
│                                                                  │
│  ═══════════════════ Event Layer ════════════════════════════    │
│  ┌──────────────────┐ ┌──────────────┐ ┌────────────────────┐    │
│  │ Index Worker     │ │ OCR Worker   │ │ Summary Worker     │    │
│  │ Loader→Parser→   │ │ (Tesseract/  │ │ (自动摘要)          │    │
│  │ Splitter→Embed   │ │  Vision)     │ │                    │    │
│  │ →Persist         │ │              │ │                    │    │
│  └──────────────────┘ └──────────────┘ └────────────────────┘    │
│  ┌──────────────────┐ ┌──────────────────────────────────────┐   │
│  │ Embedding Worker │ │ GC Worker (clean-orphan-chunks)      │   │
│  │ (独立 Queue, ★)   │ │ 软删→异步清 MinIO+向量                 │   │
│  └──────────────────┘ └──────────────────────────────────────┘   │
│  ┌──────────────────┐ ┌──────────────────────────────────────┐   │
│  │ Workflow Exec    │ │ Tool Execution Worker                │   │
│  │ Worker (V2)      │ │ (V3): 沙箱执行 SQL/HTTP/Search        │   │
│  └──────────────────┘ └──────────────────────────────────────┘   │
└────────────────────────────┬─────────────────────────────────────┘
                             │
        ┌────────────────────┼────────────────────┐
        │                    │                    │
┌───────┴───────┐  ┌─────────┴─────────┐  ┌───────┴───────┐
│  PostgreSQL   │  │    MinIO / S3     │  │    Redis      │
│  + pgvector   │  │  (Object Store)   │  │  (BullMQ)     │
│               │  │                   │  │               │
│  • kbases     │  │  • PDF files      │  │  • Job Queue  │
│  • documents  │  │  • Uploads        │  │  • Cache      │
│  • versions   │  │                   │  │  • Session    │
│  • chunks     │  │                   │  │               │
│  • jobs       │  │                   │  │               │
│  • chats      │  │                   │  │               │
│  • prompts    │  │                   │  │               │
│  • audit_logs │  │                   │  │               │
│  • api_keys   │  │                   │  │               │
│  • users      │  │                   │  │               │
│  • settings   │  │                   │  │               │
│  ★ ai_apps    │  │                   │  │               │
│  ★ models     │  │                   │  │               │
│  ★ tools      │  │                   │  │               │
│  ★ wf_nodes   │  │                   │  │               │
│  ★ wf_edges   │  │                   │  │               │
│  ★ wf_execs   │  │                   │  │               │
└───────────────┘  └───────────────────┘  └───────────────┘
```

### 关键架构决策

| 决策 | 说明 |
|------|------|
| **Knowledge Base 为核心** | 一切 AI 应用围绕知识库展开，KB 是数据资产层 |
| **AI Application 编排层** | Application = KB + Workflow + Model + Prompt + Tools 的组合，面向最终用户的产品形态 |
| **Model Center 模型管理** | 统一模型注册中心，Provider→Model 二级管理，与 API Key 解耦 |
| **Tool Center 工具** | 工具注册与执行分离，支持 SQL/HTTP/Search/Function 等类型 |
| **Workflow Engine** | Workflow → Nodes + Edges 图结构，支持 Workflow Execution 追踪 |
| **Index Pipeline 与 Query Pipeline 分离** | Upload→Chunk→Embedding 和 Question→Retriever→LLM 完全独立，换模型/重索引不影响聊天 |
| **Event Layer 解耦** | API → Event → Workers(Index/OCR/Summary/GC/Tool)。软删+异步 GC 清理，不阻塞 API 主线程 |
| **HNSW 向量索引** | pgvector HNSW 索引替代 IVFFlat，百万级数据召回率更高、并发查询性能显著提升 |
| **Hybrid Search + RRF 融合** | SparseRetriever(BM25/tsvector) + DenseRetriever(Vector/pgvector) 双路召回 → RRF 融合 → Reranker 精排 |
| **Knowledge Base 作为一级概念** | 每个 KB 可独立配置 Embedding Model + Retrieval Strategy(vector/hybrid) |
| **Document → Version → Chunk 层级** | Chunk 只属于 Version，Document 通过 Version JOIN 访问 |
| **Chat SSE 标准化协议** | step/citations/delta/error/done 五类 Event，支持 AbortController 中断 + 用户反馈 |
| **Chat Session + Workflow** | 一套 Chat 支持多种 Workflow(rag/reflection/rewoo/multi_agent)，Session 记录 workflow_type |
| **Row Level Security (RLS)** | PostgreSQL 原生 RLS 策略，数据库引擎底层强制租户/知识库权限隔离 |
| **架构预留 ≠ 当前实现** | Model Center / Tool Center / Workflow Nodes+Edges 为后期阶段设计，V1 仅实现 Knowledge Base + RAG Chat |
| **Parent-Child Chunking** | 小 Chunk 向量检索（精确匹配语义）+ 大 Chunk 作为 LLM 上下文（提供完整语境）。document_chunks.parent_chunk_id 实现级联查询 |
| **Redis 缓存分层** | ① Session 分布式锁（Redlock 防并发 LLM 调用）② Embedding 缓存（hash(query)→vector，FAQ 场景节省 API 成本）|
| **Token 计量** | chat_messages 补充 prompt_tokens / completion_tokens / total_tokens 字段，支撑用户级/应用级成本核算 |
| **Workflow 状态机** | execution_status 新增 PAUSED / WAITING 状态，支持 Human-in-the-loop 长流程暂停恢复，node_steps 持久化断点上下文 |
| **Index Job 防重** | 局部唯一索引确保同一文档同一类型同时只能有一个活跃 Job，避免重复索引导致的向量冲突 |
| **审计日志写入优化** | Write-Heavy 表建议移除物理外键（逻辑关联）+ 按月表分区，避免拖慢主库 |
| **Index Pipeline 多格式 Loader** | Loader(格式无关)→Parser(结构化)→Splitter→Embed→Persist 五阶段流水线。新增 Word/Excel/Markdown/HTML 格式只需注册 Loader，无需改 Pipeline 代码 |
| **独立 Queue 粒度** | `index`(CPU 密集)、`embedding`(IO 密集)、`cleanup`(异步 GC) 三个独立 Queue，各自独立扩缩容，互不阻塞 |
| **Knowledge Module 聚合** | NestJS 模块下 KB/Document/Version/Chunk 统一归入 `knowledge/` 父目录，代码组织更清晰 |
| **Embedding Provider 抽象** | EmbeddingProvider 接口 → OpenAI / DashScope / BGE / Ollama 多实现，换模型不改业务代码 |

---

## 2. 前端架构 (Frontend)

### 2.1 技术栈

| 层级 | 选型 | 说明 |
|------|------|------|
| 框架 | Vue 3 (Composition API) | `<script setup lang="ts">` 语法 |
| 语言 | TypeScript | 类型安全 |
| 构建 | Vite 6 | 开发 HMR + 生产 Rollup |
| UI 组件 | Element Plus + Tailwind CSS 4 | 企业级组件库 + 原子化 CSS |
| 状态管理 | Pinia | 全局状态 (auth, theme) |
| 服务端状态 | TanStack Query Vue 5 | 服务端缓存 + 自动刷新 |
| 路由 | Vue Router 4 | SPA 路由 + 懒加载 |
| HTTP 客户端 | Axios | 请求/响应拦截器, Bearer Token 注入 |
| 表单验证 | Zod v4 | `safeParse()` 手动验证 |
| 图标 | @element-plus/icons-vue | Element Plus 图标库 |
| 工具函数 | VueUse | 组合式工具函数 |
| 图表 | ECharts + vue-echarts | Dashboard 统计图表 |
| 流程图 (V3) | Vue Flow (@vue-flow/core) | Workflow Designer 拖拽编辑 |
| 代码编辑器 | Monaco Editor | JSON 配置编辑 |
| 密码加密 | jsencrypt | RSA-2048 登录加密 |

### 2.2 目录结构

```
apps/web-v2/                           # Vue 3 前端 (独立 app)
├── public/
│   └── favicon.ico
├── src/
│   ├── main.ts                        # 应用入口 (createPinia, router, ElementPlus, VueQueryPlugin)
│   ├── App.vue                        # 根组件
│   │
│   ├── views/                         # 页面组件 (Vue Router 懒加载)
│   │   ├── Dashboard.vue              #   平台总览
│   │   ├── Login.vue                  #   登录
│   │   ├── Register.vue               #   注册
│   │   │
│   │   ├── KnowledgeBases.vue         #   知识库列表
│   │   ├── KnowledgeBaseDetail.vue    #   知识库详情 (含文档 Tab)
│   │   ├── Documents.vue              #   文档列表
│   │   ├── DocumentDetail.vue         #   文档详情 + Chunks
│   │   │
│   │   ├── AiApplications.vue         # ★ AI 应用列表 (V2)
│   │   ├── AiApplicationDetail.vue    # ★ 应用详情
│   │   │
│   │   ├── Chat.vue                   #   会话列表
│   │   ├── ChatSession.vue            #   对话 (含 SSE 流式)
│   │   │
│   │   ├── Workflows.vue              # ★ Workflow 列表
│   │   ├── WorkflowDetail.vue         # ★ Workflow 详情
│   │   ├── WorkflowDesigner.vue       # ★ (V3) Vue Flow 可视化编辑器
│   │   │
│   │   ├── Models.vue                 # ★ Model Center (V2)
│   │   ├── Tools.vue                  # ★ Tool Center (V3)
│   │   ├── Jobs.vue                   #   Index Job 监控
│   │   │
│   │   ├── Settings.vue               #   系统设置
│   │   ├── ApiKeys.vue                #   API Key 管理
│   │   ├── Prompts.vue                #   Prompt Template 管理
│   │   └── AuditLogs.vue              #   审计日志
│   │
│   ├── components/                    # 共享组件
│   │   ├── layout/                    # 布局组件
│   │   │   ├── AppSidebar.vue         #   侧边导航 (Element Plus icons)
│   │   │   ├── AppHeader.vue          #   顶部栏 (面包屑 + 用户菜单)
│   │   │   └── ThemeSwitcher.vue      #   主题切换 (配色 + 暗色)
│   │   │
│   │   ├── auth/                      # 认证组件
│   │   │   └── AuthCard.vue           #   登录/注册卡片容器
│   │   │
│   │   ├── knowledge-bases/
│   │   │   ├── KbCard.vue            #   知识库卡片
│   │   │   └── KbCreateDialog.vue     #   创建知识库对话框
│   │   │
│   │   ├── documents/
│   │   │   ├── DocumentTable.vue      #   文档列表表格
│   │   │   └── DocumentUpload.vue     #   上传组件 (el-upload)
│   │   │
│   │   ├── ai-applications/
│   │   │   └── AppCard.vue            # ★ 应用卡片
│   │   │
│   │   ├── chat/
│   │   │   ├── ChatSessionList.vue    #   会话列表
│   │   │   ├── ChatMessage.vue        #   消息气泡
│   │   │   └── ChatInput.vue          #   输入框
│   │   │
│   │   ├── workflows/
│   │   │   ├── WorkflowCard.vue       # ★ Workflow 卡片
│   │   │   └── ExecutionList.vue      # ★ 执行历史
│   │   │
│   │   ├── models/
│   │   │   ├── ModelCard.vue          # ★ Model 卡片
│   │   │   └── ModelForm.vue          # ★ Model 表单
│   │   │
│   │   ├── tools/
│   │   │   └── ToolCard.vue           # ★ Tool 卡片
│   │   │
│   │   └── jobs/
│   │       └── JobTable.vue           #   Job 表格
│   │
│   ├── api/                           # API 请求层 (Axios)
│   │   ├── client.ts                  #   Axios 实例 (拦截器: Bearer Token, 401 跳转)
│   │   ├── auth.ts                    #   登录/注册/用户信息
│   │   ├── knowledge-bases.ts
│   │   ├── documents.ts
│   │   ├── chat.ts
│   │   ├── workflows.ts               # ★
│   │   ├── ai-applications.ts         # ★
│   │   ├── models.ts                  # ★
│   │   ├── tools.ts                   # ★
│   │   ├── jobs.ts
│   │   ├── prompts.ts
│   │   ├── api-keys.ts
│   │   ├── settings.ts
│   │   └── audit-logs.ts
│   │
│   ├── stores/                        # Pinia 全局状态
│   │   ├── auth.ts                    #   用户认证状态
│   │   ├── theme.ts                   #   主题状态 (light/dark)
│   │   └── breadcrumb.ts              #   面包屑标签映射
│   │
│   ├── composables/                   # TanStack Query Vue 封装
│   │   ├── use-knowledge-bases.ts
│   │   ├── use-documents.ts
│   │   ├── use-chat.ts
│   │   ├── use-workflows.ts           # ★
│   │   ├── use-ai-applications.ts     # ★
│   │   ├── use-models.ts              # ★
│   │   ├── use-tools.ts               # ★
│   │   └── use-jobs.ts
│   │
│   ├── router/
│   │   └── index.ts                   # Vue Router 配置 (21 routes, beforeEach guard)
│   │
│   ├── layouts/
│   │   └── MainLayout.vue             # 主布局 (Sidebar + Header + router-view)
│   │
│   ├── types/                         # TypeScript 接口 (12 files)
│   │   ├── knowledge-base.ts
│   │   ├── document.ts
│   │   ├── chunk.ts
│   │   ├── chat.ts
│   │   ├── workflow.ts                # ★
│   │   ├── ai-application.ts          # ★
│   │   ├── model.ts                   # ★
│   │   ├── tool.ts                    # ★
│   │   ├── job.ts
│   │   ├── prompt.ts
│   │   ├── audit-log.ts
│   │   └── settings.ts
│   │
│   ├── utils/                         # 工具函数
│   │   ├── format.ts
│   │   ├── constants.ts
│   │   └── rsa-encrypt.ts
│   │
│   ├── validations/                   # Zod schemas
│   │   └── auth.ts
│   │
│   └── styles/
│       └── globals.css                # Tailwind CSS 4 + Element Plus 主题桥接
│                                      #   3 配色主题: Uber / Coinbase / Rabbit
│
├── index.html                         # HTML 入口 (含 anti-FOUC 脚本)
├── vite.config.ts                     # Vite 配置 (plugins, alias, proxy, port 3034)
├── tsconfig.json
├── eslint.config.mjs
├── env.d.ts
├── .env
├── .gitignore
├── nginx.conf                         # Docker SPA 部署配置
├── package.json
└── README.md
```

### 2.3 页面设计

#### 页面 0: Dashboard (平台总览)

```
┌─────────────────────────────────────────────────────────┐
│  Enterprise AI Platform                          [User] │
├─────────────────────────────────────────────────────────┤
│  ┌ Sidebar ┐  平台概览                                   │
│  │         │  ┌──────────┐ ┌──────────┐ ┌──────────┐    │
│  │ 仪表盘   │  │ 3        │ │ 12       │ │ 156      │    │
│  │ 知识库   │  │ 知识库    │ │ 文档     │ │ Chunks    │    │
│  │ AI应用   │  └──────────┘ └──────────┘ └──────────┘    │
│  │ 对话     │  ┌──────────┐ ┌──────────┐ ┌──────────┐    │
│  │ Workflow│  │ 5        │ │ 8        │ │ 2        │    │
│  │ 模型     │  │ AI 应用  │ │ 模型      │ │ 工具      │    │
│  │ 工具     │  └──────────┘ └──────────┘ └──────────┘    │
│  │ Job     │                                            │
│  │ 设置     │  ┌─ 最近对话 ────────────────────────────┐  │
│  │ 审计     │  │  财务助手 · 报销流程 ................   │ │
│  │         │  │  HR 助手 · 请假规定 ................   │  │
│  └─────────┘  └──────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
```

#### 页面 1: Knowledge Base List (顶层入口)

```
┌─────────────────────────────────────────────────────────┐
│  Enterprise AI Platform                          [User] │
├─────────────────────────────────────────────────────────┤
│  ┌ Sidebar ┐                                            │
│  │         │  知识库                                     │
│  │ 知识库   │  ┌──────────┐ ┌──────────┐ ┌──────────┐    │
│  │         │  │ HR       │ │ Finance  │ │ R&D      │    │
│  │         │  │ 员工手册   │ │ 财务制度 │ │ 研发规范   │    │
│  │         │  │ 考勤制度   │ │ 发票规范 │ │ API文档   │    │
│  │         │  │ 3 docs   │ │ 2 docs   │ │ 1 doc    │    │
│  │         │  └──────────┘ └──────────┘ └──────────┘    │
│  │         │                                            │
│  │         │  [+ 新建知识库]                              │
│  └─────────┘                                            │
└─────────────────────────────────────────────────────────┘
```

功能: 创建/删除知识库, 编辑名称/描述, 配置权限 (Admin/Editor/Viewer)

#### 页面 2: AI Applications (V2)

```
┌─────────────────────────────────────────────────────────┐
│  AI 应用中心                                      [User] │
├─────────────────────────────────────────────────────────┤
│  ┌ Sidebar ┐                                            │
│  │         │   AI 应用                                   │
│  │ AI应用   │  ┌──────────┐ ┌──────────┐ ┌──────────┐    │
│  │         │  │ 💰       │ │ 👥       │ │ 🔧       │    │
│  │         │  │ 财务助手   │ │ HR 助手  │ │ 研发助手   │    │
│  │         │  │          │ │          │ │          │    │
│  │         │  │ KB: 财务  │ │ KB: HR   │ │ KB: R&D  │    │
│  │         │  │ WF: Refl │ │ WF: RAG  │ │ WF: ReWOO│    │
│  │         │  │ 🤖 DeepS │ │ 🤖 Qwen  │ │ 🤖 GPT4o │    │
│  │         │  └──────────┘ └──────────┘ └──────────┘    │
│  │         │                                            │
│  │         │  [+ 创建 AI 应用]                           │
│  └─────────┘                                            │
│                                                         │
│  每个 AI 应用 = 知识库 + Workflow + Model + Prompt        │
└─────────────────────────────────────────────────────────┘
```

#### 页面 3: AI Application Config (V2)

```
┌─────────────────────────────────────────────────────────┐
│  编辑: 财务助手                                           │
│                                                         │
│  ┌─ 基本信息 ─────────────────────────────────────────┐  │
│  │  名称: [财务助手          ]                         │  │
│  │  描述: [解答财务制度相关问题  ]                       │  │
│  └───────────────────────────────────────────────────┘  │
│                                                         │
│  ┌─ 绑定资源 ────────────────────────────────────────┐   │
│  │  知识库:   [财务制度 ▼]                            │   │
│  │  Workflow: [Reflection RAG ▼]                    │   │
│  │  Model:    [DeepSeek-V3 ▼]                       │   │
│  │  Prompt:   [财务助手 Prompt (v3) ▼]               │   │
│  │  Tools:    [☑ SQL查询] [☑ 计算器] [☐ 搜索]         │   │
│  └─────────────────────────────────────────────────┘    │
│                                                         │
│  [保存]  [测试对话]                                       │
└─────────────────────────────────────────────────────────┘
```

#### 页面 4: Document List (在知识库内)

```
┌────────────────────────────────────────────────────────┐
│  HR / 文档列表                                   [User] │
├────────────────────────────────────────────────────────┤
│  ┌──────────────────────────────────────────────────┐  │
│  │ [+ 上传文档]          搜索...                      │  │
│  │                                                  │  │
│  │  文件名         版本   状态    Chunks  时间         │  │
│  │  ─────────────────────────────────────────────── │  │
│  │  员工手册.pdf   v3     Ready    145    07-18      │  │
│  │  考勤制度.pdf   v1     Ready     32    07-20      │  │
│  │  培训材料.pdf   v2     Process    0    07-22      │  │
│  │                                                  │  │
│  │  操作: [详情] [版本历史] [重新索引] [删除]            │  │
│  └──────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────┘
```

#### 页面 5: Document Detail (含版本历史)

```
┌─────────────────────────────────────────────────────────┐
│  文档详情: 员工手册.pdf                                    │
│                                                         │
│  ┌─ 版本 ────────────────────────────────────────────┐   │
│  │  当前: v3 (2026-07-18)  [v1] [v2] [v3]            │   │
│  └──────────────────────────────────────────────────┘   │
│                                                         │
│  ┌─ Document Info ────────────────────────────────────┐ │
│  │  Status: Ready  │  Chunks: 145  │  Dim: 1536       │ │
│  └────────────────────────────────────────────────────┘ │
│                                                         │
│  ┌─ Chunks (v3) ─────────────────────────────────────┐  │
│  │  Chunk 1  (Page 1)                                │  │
│  │  公司实行弹性工作制...                               │  │
│  │  Metadata: { "source": "员工手册.pdf", ... }       │  │
│  │  ─────────────────────────────────────────────    │  │
│  │  Chunk 2  (Page 1)                                │  │
│  │  员工请假需提前...                                  │  │
│  └───────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
```

#### 页面 6: Model Center (V2)

```
┌────────────────────────────────────────────────────────┐
│  Model Center                                    [User]│
├────────────────────────────────────────────────────────┤
│  ┌──────────────────────────────────────────────────┐  │
│  │  Provider   Model               Type     Status  │  │
│  │  ─────────────────────────────────────────────── │  │
│  │  OpenAI     gpt-4o              chat     Active  │  │
│  │  OpenAI     text-embedding-3-lg embedding Active │  │
│  │  DeepSeek   deepseek-chat       chat     Active  │  │
│  │  Qwen       qwen-turbo          chat     Active  │  │
│  │  Cohere     rerank-v3           rerank   Active  │  │
│  │  BGE        bge-reranker-v2-m3  rerank   Active  │  │
│  │                                                  │  │
│  │  [+ 注册模型]                                     │  │
│  └──────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────┘
```

#### 页面 7: Tool Center (V3)

```
┌────────────────────────────────────────────────────────┐
│  Tool Center                                    [User] │
├────────────────────────────────────────────────────────┤
│  ┌──────────────────────────────────────────────────┐  │
│  │  Name        Type        Description     Status  │  │
│  │  ─────────────────────────────────────────────── │  │
│  │  SQL Query   sql         数据库查询       Active   │  │
│  │  Web Search  search      Web 搜索        Active   │  │
│  │  Calculator  function    数学计算        Active    │  │
│  │  HTTP Req    http         HTTP 请求       Active  │  │
│  │  File Reader filesystem  文件读取        Active    │  │
│  │                                                  │  │
│  │  [+ 注册工具]                                     │  │
│  └──────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────┘
```

#### 页面 8: RAG Chat (含 Session + Citation)

```
┌───────────────────────────────────────────────────────┐
│  Chat                                       [Session] │
├───────────────────────────────────────────────────────┤
│  ┌ 会话列表 ┐  ┌──────────────────────────────────┐    │
│  │ 💰 财务 │  │                                  │    │
│  │ 07-22   │  │  User: 公司请假流程是什么?          │    │
│  │ 请假流程 │  │                                  │    │
│  │ 👥 HR   │  │  AI: 根据员工手册，请假需提前...     │    │
│  │ 07-21   │  │                                  │    │
│  │ 报销规定 │  │  📎 来源:                         │    │
│  │         │  │  • 员工手册.pdf (第12页)           │    │
│  │ [+新会话]│  │  • 考勤制度.pdf (第3页)            │    │
│  └─────────┘  │                                  │    │
│               │  ┌─────────────────────────────┐ │    │
│               │  │ 输入问题...             [发送]│ │    │
│               │  └─────────────────────────────┘ │    │
│               └──────────────────────────────────┘    │
└───────────────────────────────────────────────────────┘
```

#### 页面 9: Workflow (V2, JSON Config)

```
┌────────────────────────────────────────────────────────┐
│  Workflow: Reflection RAG                              │
│                                                        │
│  ┌─ Config (JSON) ───────────────────────────────────┐ │
│  │  {                                                │ │
│  │    "type": "reflection_rag",                      │ │
│  │    "nodes": [                                     │ │
│  │      {"id": "retriever", "type": "retriever"},    │ │
│  │      {"id": "llm", "type": "llm"},                │ │
│  │      {"id": "judge", "type": "reflection"}        │ │
│  │    ],                                             │ │
│  │    "edges": [                                     │ │
│  │      {"from": "retriever", "to": "llm"},          │ │
│  │      {"from": "llm", "to": "judge"},              │ │
│  │      {"from": "judge", "to": "retriever",         │ │
│  │       "condition": "needs_improvement"}           │ │
│  │    ]                                              │ │
│  │  }                                                │ │
│  └───────────────────────────────────────────────────┘ │
│                                                        │
│  ┌─ Executions ──────────────────────────────────────┐ │
│  │  Time       Status    Duration   Input            │ │
│  │  ───────────────────────────────────────────────  │ │
│  │  07-22 14:30 Done     2.3s      请假流程...        │ │
│  │  07-22 14:00 Failed   5.1s      报销规定...        │ │
│  └──────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────┘
```

#### 页面 10: Prompt Template 管理

```
┌─────────────────────────────────────────────────────────┐
│  Prompt Template 管理                                    │
│                                                         │
│  ┌─ Templates ────────────────────────────────────────┐ │
│  │  Name          Latest    Updated                   │ │
│  │  ───────────────────────────────────────────────── │ │
│  │  RAG Default   v3       07-18   [编辑] [历史]       │ │
│  │  HR Assistant  v1       07-20   [编辑] [历史]       │ │
│  │  Summary       v2       07-15   [编辑] [历史]       │ │
│  └────────────────────────────────────────────────────┘ │
│                                                         │
│  ┌─ Preview (RAG Default v3) ─────────────────────────┐ │
│  │  You are a helpful AI assistant.                   │ │
│  │  Use the following context to answer the question. │ │
│  │  Context: {{context}}                              │ │
│  │  Question: {{question}}                            │ │
│  │  If you don't know, say so.                        │ │
│  └────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────┘
```

#### 页面 11: Audit Log

```
┌─────────────────────────────────────────────────────────┐
│  审计日志                                                │
│                                                         │
│  ┌─ Filters ──────────────────────────────────────────┐ │
│  │  User: [All]  Action: [All]  KB: [All]  Date: ...  │ │
│  └────────────────────────────────────────────────────┘ │
│                                                         │
│  │  Time       User    Action        Target            │
│  │  ─────────────────────────────────────────────────  │
│  │  07-22 14:30 zhang  上传文档      HR/员工手册v3        │
│  │  07-22 14:00 lisi   删除文档      Finance/旧发票      │
│  │  07-22 13:00 wang   重新索引      R&D/API文档         │
│  │  07-22 10:00 admin  修改权限      HR → Editor        │
└────────────────────────────────────────────────────────┘
```

---

## 3. 后端架构 (Backend)

### 3.1 技术栈

| 层级 | 选型 | 说明 |
|------|------|------|
| 框架 | NestJS | 模块化、依赖注入、企业级 |
| 语言 | TypeScript | 与前端同语言 |
| HTTP | axios | 获取数据 |
| ORM | Prisma | 数据库操作 + pgvector |
| 向量扩展 | pgvector | PostgreSQL 向量存储 |
| 队列 | BullMQ (Redis) | Worker 异步任务 |
| Event Bus | NestJS EventEmitter → BullMQ | 当前阶段; 后续升级 Kafka |
| 文件存储 | MinIO (S3-compatible) | PDF 对象存储 |
| 文档处理 | LangChain.js | Loader, Splitter, Embedding |
| Agent 编排 | LangGraph | Workflow Execution Runtime |
| 验证 | class-validator + class-transformer | DTO 验证 |
| API 文档 | Swagger (NestJS OpenAPI) | 自动生成 |
| 日志 | Pino | 结构化日志 |

### 3.2 目录结构

```
backend/
├── src/
│   ├── main.ts                       # 应用入口 (API 进程)
│   ├── main.worker.ts                # Worker 入口 (独立进程)
│   ├── app.module.ts                 # API 根模块
│   ├── worker.module.ts              # Worker 根模块
│   │
│   ├── common/                       # 公共模块
│   │   ├── decorators/
│   │   ├── filters/
│   │   ├── interceptors/
│   │   ├── pipes/
│   │   ├── guards/
│   │   ├── dto/
│   │   │   ├── pagination.dto.ts
│   │   │   └── response.dto.ts
│   │   └── constants/
│   │       ├── document-status.enum.ts
│   │       ├── job-status.enum.ts
│   │       ├── embedding-provider.enum.ts
│   │       ├── audit-action.enum.ts
│   │       ├── model-type.enum.ts        # ★ chat | embedding | rerank
│   │       └── tool-type.enum.ts         # ★ sql | http | search | function | filesystem
│   │
│   ├── config/                       # 配置模块
│   │   ├── database.config.ts
│   │   ├── redis.config.ts
│   │   ├── minio.config.ts
│   │   └── embedding.config.ts
│   │
│   ├── infrastructure/               # 基础设施
│   │   ├── database/
│   │   │   ├── database.module.ts
│   │   │   └── migrations/
│   │   ├── storage/
│   │   │   ├── storage.module.ts
│   │   │   └── storage.service.ts
│   │   ├── queue/
│   │   │   ├── queue.module.ts
│   │   │   └── queue.service.ts
│   │   └── event-bus/                # Event Bus
│   │       ├── event-bus.module.ts
│   │       ├── events/
│   │       │   ├── document-uploaded.event.ts
│   │       │   ├── document-deleted.event.ts
│   │       │   ├── index-requested.event.ts
│   │       │   └── tool-execution-requested.event.ts  # ★
│   │       └── event-bus.service.ts
│   │
│   ├── modules/                      # 业务模块
│   │   │
│   │   ├── auth/                     # 认证模块
│   │   │   ├── auth.module.ts
│   │   │   ├── auth.controller.ts
│   │   │   ├── auth.service.ts
│   │   │   ├── auth.guard.ts
│   │   │   ├── dto/
│   │   │   └── strategies/
│   │   │       └── jwt.strategy.ts
│   │   │
│   │   ├── user/                     # 用户模块
│   │   │   ├── user.module.ts
│   │   │   ├── user.controller.ts
│   │   │   ├── user.service.ts
│   │   │   └── entities/
│   │   │
│   │   ├── knowledge/                # ★★★ Knowledge Module (知识资产核心)
│   │   │   │
│   │   │   ├── knowledge-base/       #   知识库子模块
│   │   │   │   ├── knowledge-base.module.ts
│   │   │   │   ├── knowledge-base.controller.ts
│   │   │   │   ├── knowledge-base.service.ts
│   │   │   │   ├── dto/
│   │   │   │   └── entities/
│   │   │   │
│   │   │   ├── permission/           #   权限子模块
│   │   │   │   ├── permission.module.ts
│   │   │   │   ├── permission.service.ts
│   │   │   │   ├── permission.guard.ts
│   │   │   │   └── decorators/
│   │   │   │
│   │   │   ├── document/             #   文档子模块
│   │   │   │   ├── document.module.ts
│   │   │   │   ├── document.controller.ts
│   │   │   │   ├── document.service.ts
│   │   │   │   ├── dto/
│   │   │   │   └── entities/
│   │   │   │
│   │   │   ├── version/              #   版本子模块
│   │   │   │   ├── version.module.ts
│   │   │   │   ├── version.service.ts
│   │   │   │   ├── dto/
│   │   │   │   └── entities/
│   │   │   │
│   │   │   └── chunk/                #   Chunk 子模块
│   │   │       ├── chunk.module.ts
│   │   │       ├── chunk.controller.ts
│   │   │       ├── chunk.service.ts
│   │   │       ├── dto/
│   │   │       └── entities/
│   │   │
│   │   ├── embedding/                # Embedding 模块
│   │   │   ├── embedding.module.ts
│   │   │   ├── embedding.service.ts
│   │   │   └── providers/
│   │   │       ├── embedding-provider.interface.ts
│   │   │       ├── openai-embedding.provider.ts
│   │   │       ├── dashscope-embedding.provider.ts
│   │   │       ├── bge-embedding.provider.ts
│   │   │       └── ollama-embedding.provider.ts   # ★ 本地部署
│   │   │
│   │   ├── retrieval/                # ★ Retrieval Pipeline (Hybrid Search)
│   │   │   ├── retrieval.module.ts
│   │   │   ├── retrieval.controller.ts
│   │   │   ├── retrieval.service.ts       # 编排双路召回+RRF融合
│   │   │   ├── retrievers/
│   │   │   │   ├── base-retriever.ts
│   │   │   │   ├── dense-retriever.ts     # pgvector HNSW
│   │   │   │   └── sparse-retriever.ts    # BM25 tsvector
│   │   │   ├── fusion/
│   │   │   │   └── rrf.service.ts         # Reciprocal Rank Fusion
│   │   │   ├── reranker/
│   │   │   │   ├── reranker.interface.ts
│   │   │   │   ├── bge-reranker.service.ts
│   │   │   │   └── cohere-reranker.service.ts
│   │   │   ├── citation/
│   │   │   │   └── citation.service.ts
│   │   │   └── dto/
│   │   │
│   │   ├── chat/                     # 对话模块
│   │   │   ├── chat.module.ts
│   │   │   ├── chat.controller.ts
│   │   │   ├── chat.service.ts
│   │   │   ├── session.service.ts    # ★ Session 管理
│   │   │   ├── citation.service.ts   # ★ 引用生成
│   │   │   ├── dto/
│   │   │   └── entities/
│   │   │
│   │   ├── ai-application/           # ★★★ AI 应用模块 (V2)
│   │   │   ├── ai-application.module.ts
│   │   │   ├── ai-application.controller.ts
│   │   │   ├── ai-application.service.ts       # 编排 KB + WF + Model + Prompt + Tools
│   │   │   ├── dto/
│   │   │   └── entities/
│   │   │
│   │   ├── model/                    # ★★ Model Center (V2)
│   │   │   ├── model.module.ts
│   │   │   ├── model.controller.ts
│   │   │   ├── model.service.ts
│   │   │   ├── dto/
│   │   │   └── entities/
│   │   │
│   │   ├── tool/                     # ★★ Tool Center (V3)
│   │   │   ├── tool.module.ts
│   │   │   ├── tool.controller.ts
│   │   │   ├── tool.service.ts
│   │   │   ├── tool-executor.service.ts       # 工具执行器 (沙箱)
│   │   │   ├── dto/
│   │   │   └── entities/
│   │   │
│   │   ├── prompt-template/          # ★ Prompt 模板
│   │   │   ├── prompt-template.module.ts
│   │   │   ├── prompt-template.controller.ts
│   │   │   ├── prompt-template.service.ts
│   │   │   ├── dto/
│   │   │   └── entities/
│   │   │
│   │   ├── audit-log/                # ★ 审计日志
│   │   │   ├── audit-log.module.ts
│   │   │   ├── audit-log.controller.ts
│   │   │   ├── audit-log.service.ts
│   │   │   └── entities/
│   │   │
│   │   ├── api-key/                  # ★ API Key
│   │   │   ├── api-key.module.ts
│   │   │   ├── api-key.controller.ts
│   │   │   ├── api-key.service.ts
│   │   │   └── entities/
│   │   │
│   │   └── workflow/                 # ★ Workflow 模块 (增强: Nodes + Edges + Execution)
│   │       ├── workflow.module.ts
│   │       ├── workflow.controller.ts
│   │       ├── workflow.service.ts
│   │       ├── execution.service.ts      # ★ Workflow 执行追踪
│   │       ├── dto/
│   │       ├── entities/
│   │       └── strategies/               # ★ 策略模式: 不同 Workflow
│   │           ├── workflow-strategy.interface.ts
│   │           ├── rag.strategy.ts
│   │           ├── reflection.strategy.ts
│   │           ├── rewoo.strategy.ts
│   │           └── multi-agent.strategy.ts
│   │
│   └── worker/                       # Worker 进程 (独立, 消费 Event)
│       ├── worker.module.ts
│       ├── worker.processor.ts
│       ├── worker.service.ts
│       │
│       ├── pipelines/                # Index Pipeline (生产侧)
│       │   ├── index-pipeline.ts     # 编排: Loader → Parser → Splitter → Persist
│       │   ├── reindex-pipeline.ts
│       │   │
│       │   ├── loaders/              # ★ 多格式 Loader (策略模式, 格式无关)
│       │   │   ├── loader.interface.ts
│       │   │   ├── pdf-loader.ts
│       │   │   ├── word-loader.ts    # (V2.5)
│       │   │   ├── markdown-loader.ts# (V2.5)
│       │   │   ├── excel-loader.ts   # (V2.5)
│       │   │   └── html-loader.ts    # (V2.5)
│       │   │
│       │   ├── parsers/              # ★ 解析器 (Loader 输出 → 结构化文本)
│       │   │   ├── parser.interface.ts
│       │   │   └── text-parser.ts
│       │   │
│       │   ├── splitters/            # 分割器
│       │   │   ├── splitter.interface.ts
│       │   │   └── text-splitter.ts
│       │   │
│       │   ├── embedders/            # Embedding 调用
│       │   │   ├── embedder.interface.ts
│       │   │   └── batch-embedder.ts
│       │   │
│       │   └── persist/              # ★ 持久化 (Chunk + Vector)
│       │       ├── persist.service.ts
│       │       └── batch-writer.ts
│       │
│       └── consumers/                # Event 消费者
│           ├── index.consumer.ts     # 消费 document.uploaded → Loader+Parser+Splitter+Persist → 再 enqueue embedding
│           ├── embedding.consumer.ts # ★ 独立: 消费 index.chunks_persisted → Embedding → 写入向量
│           ├── gc.consumer.ts        # ★ 消费 deleted → 统一异步 GC (cleanup Queue)
│           ├── ocr.consumer.ts       # 消费 image.uploaded → OCR (V3)
│           ├── summary.consumer.ts   # 消费 index.completed → 生成摘要 (V2)
│           ├── workflow-exec.consumer.ts  # ★ 消费 workflow.execute → LangGraph Runtime (V2)
│           └── tool-exec.consumer.ts      # ★ 消费 tool.execute → 沙箱执行 (V3)
│
├── test/
├── nest-cli.json
├── tsconfig.json
├── package.json
└── .env
```

### 3.3 模块职责

| 模块 | 职责 | API 端点 | 阶段 |
|------|------|---------|------|
| **Auth** | 登录/注册, JWT 签发 | `POST /api/v1/auth/login`, `POST /api/v1/auth/register` | V1 |
| **User** | 用户 CRUD | `GET/PATCH /api/v1/users/:id` | V1 |
| **Knowledge Module** (★ 聚合) | 知识资产管理: KB → Document → Version → Chunk 完整生命周期 | (子模块路由汇总) | V1 |
| ├ **Knowledge Base** | 知识库 CRUD, 每 KB 可配独立的 Embedding Model + Retrieval Strategy | `POST/GET/PATCH/DELETE /api/v1/knowledge-bases` | V1 |
| ├ **Permission** | KB 级别 RBAC (Admin/Editor/Viewer) | 内部 Service, 从 KnowledgeBase 路由挂载 | V1 |
| ├ **Document** | 上传/删除/列表/详情, 发 Event → Index Pipeline | `POST/GET/DELETE /api/v1/knowledge-bases/:kbId/documents` | V1 |
| ├ **Version** | 版本历史, 版本切换, 版本级 Chunk 管理 | `GET /api/v1/documents/:id/versions` | V1 |
| └ **Chunk** | 查询某 Version 的 Chunk (Chunk 只属于 Version) | `GET /api/v1/versions/:vid/chunks` | V1 |
| **Embedding** | 多 Provider 切换 (OpenAI/DashScope/BGE/Ollama), 向量化 | (内部 Service) | V1 |
| **Retrieval Pipeline** | Vector Search → Rerank → Citation → Return 分层流水线 | `POST /api/v1/retrieval/search` | V1 |
| **Chat** | RAG 对话 + Session(含 workflow_type) + Citation | `POST /api/v1/chat`, `GET /api/v1/chat/sessions` | V1 |
| **AI Application** (★新增) | AI 应用 CRUD, 绑定 KB+Workflow+Model+Prompt+Tools 形成产品 | `POST/GET/PATCH/DELETE /api/v1/ai-applications` | **V2** |
| **Model** (★新增) | 模型注册中心: Provider + Model + Type, 统一管理 LLM/Embedding/Rerank 模型 | `POST/GET/DELETE /api/v1/models` | **V2** |
| **Tool** (★新增) | 工具注册中心: SQL/HTTP/Search/Function, 供 Workflow/Agent 调用 | `POST/GET/DELETE /api/v1/tools` | **V3** |
| **Prompt Template** | 模板 CRUD + 版本管理 | `POST/GET/PATCH /api/v1/prompt-templates` | V1 |
| **Audit Log** | 操作审计日志查询 | `GET /api/v1/audit-logs` | V1 |
| **API Key** | Provider+Model+BaseURL+Key 完整管理 (仅管凭证) | `POST/GET/DELETE /api/v1/api-keys` | V1 |
| **Workflow** | Workflow CRUD + Nodes/Edges 图结构 + 执行追踪 + 策略选择 | `POST/GET/PATCH /api/v1/workflows`, `POST /api/v1/workflows/:id/run` | V1 (基础) / **V2** (增强) |

### 3.4 API 设计 (完整版)

```
Base URL: /api/v1

─────────────────────────────────────────────────────
Auth (V1)
─────────────────────────────────────────────────────
POST   /auth/login
POST   /auth/register
POST   /auth/refresh

─────────────────────────────────────────────────────
Dashboard (V2)
─────────────────────────────────────────────────────
GET    /dashboard                           # 平台统计概览

─────────────────────────────────────────────────────
Knowledge Bases (V1)
─────────────────────────────────────────────────────
GET    /knowledge-bases                     # 当前用户可访问的知识库列表
POST   /knowledge-bases                     # 创建知识库
GET    /knowledge-bases/:id                 # 知识库详情 + 文档统计
PATCH  /knowledge-bases/:id                 # 更新名称/描述
DELETE /knowledge-bases/:id                 # 删除知识库
GET    /knowledge-bases/:id/permissions     # 权限列表
PUT    /knowledge-bases/:id/permissions     # 更新权限

─────────────────────────────────────────────────────
Documents (在知识库下) (V1)
─────────────────────────────────────────────────────
GET    /knowledge-bases/:kbId/documents         # 文档列表
POST   /knowledge-bases/:kbId/documents         # 上传 (multipart/form-data)
GET    /documents/:id                            # 文档详情
DELETE /documents/:id                            # 删除文档
POST   /documents/:id/reindex                    # 重新 Embedding
GET    /documents/:id/versions                   # 版本历史
POST   /documents/:id/versions/:versionId/activate # 切换活跃版本

─────────────────────────────────────────────────────
Chunks (V1)
─────────────────────────────────────────────────────
GET    /documents/:id/chunks?version=:vid        # Chunk 列表 (指定版本)

─────────────────────────────────────────────────────
Jobs (V1)
─────────────────────────────────────────────────────
GET    /jobs                                     # Job 列表
GET    /jobs/:id                                 # Job 详情 + 进度

─────────────────────────────────────────────────────
AI Applications (★ V2 核心)
─────────────────────────────────────────────────────
GET    /ai-applications                          # 应用列表
POST   /ai-applications                          # 创建应用 (绑定 KB + WF + Model + Prompt + Tools)
GET    /ai-applications/:id                      # 应用详情
PATCH  /ai-applications/:id                      # 更新应用配置
DELETE /ai-applications/:id                      # 删除应用
POST   /ai-applications/:id/test                 # 测试对话

─────────────────────────────────────────────────────
Models (★ V2)
─────────────────────────────────────────────────────
GET    /models                                   # 模型列表 (可按 type 筛选: chat/embedding/rerank)
POST   /models                                   # 注册模型
GET    /models/:id                               # 模型详情
PATCH  /models/:id                               # 更新模型配置
DELETE /models/:id                               # 删除模型

─────────────────────────────────────────────────────
Tools (★ V3)
─────────────────────────────────────────────────────
GET    /tools                                    # 工具列表 (可按 type 筛选)
POST   /tools                                    # 注册工具
GET    /tools/:id                                # 工具详情
PATCH  /tools/:id                                # 更新工具配置
DELETE /tools/:id                                # 删除工具
POST   /tools/:id/test                           # 测试工具执行

─────────────────────────────────────────────────────
Chat (V1, V2 增强)
─────────────────────────────────────────────────────
GET    /chat/sessions                            # 会话列表 (可按 app_id / workflow_type 筛选)
POST   /chat/sessions                            # 创建会话 (body: ai_application_id 或 kb_id + workflow_type)
DELETE /chat/sessions/:id                        # 删除会话
GET    /chat/sessions/:id/messages               # 消息历史
POST   /chat/sessions/:id/messages               # 发送消息 (SSE Streaming)

─────────────────────────────────────────────────────
Workflows (V1 基础 / V2 增强)
─────────────────────────────────────────────────────
GET    /workflows                                # Workflow 列表
POST   /workflows                                # 创建 Workflow 配置 (含 nodes + edges)
GET    /workflows/:id                            # Workflow 详情 + 图结构
PATCH  /workflows/:id                            # 更新配置 (打新版本)
POST   /workflows/:id/run                        # 手动执行 Workflow
GET    /workflows/:id/executions                 # ★ 执行历史列表
GET    /workflows/:id/executions/:execId         # ★ 单次执行详情 (含 per-node steps)

─────────────────────────────────────────────────────
Retrieval (V1)
─────────────────────────────────────────────────────
POST   /retrieval/search                         # 向量检索 (可指定 kbIds)

─────────────────────────────────────────────────────
Prompt Templates (V1)
─────────────────────────────────────────────────────
GET    /prompt-templates                         # 模板列表
POST   /prompt-templates                         # 创建模板
PATCH  /prompt-templates/:id                     # 更新模板 (自动打新版本)
GET    /prompt-templates/:id/versions            # 版本历史

─────────────────────────────────────────────────────
Audit Logs (V1)
─────────────────────────────────────────────────────
GET    /audit-logs                               # 审计日志 (筛选)

─────────────────────────────────────────────────────
API Keys (V1)
─────────────────────────────────────────────────────
GET    /api-keys                                 # API Key 列表 (脱敏)
POST   /api-keys                                 # 添加 API Key
DELETE /api-keys/:id                             # 删除 API Key

─────────────────────────────────────────────────────
Settings (V1)
─────────────────────────────────────────────────────
GET    /settings                                 # 获取当前设置
PUT    /settings                                 # 更新设置
```

---

## 4. Event Bus & Worker 架构 (增强)

### 4.1 事件驱动 Index Pipeline

```
┌──────────────────────────────────────────────────┐
│                  NestJS API                      │
│                                                  │
│  DocumentController.upload()                     │
│       │                                          │
│       ├── 1. 上传 MinIO (save file)               │
│       ├── 2. INSERT document (status=UPLOADING)  │
│       ├── 3. INSERT document_version             │
│       ├── 4. INSERT audit_log                    │
│       └── 5. eventBus.emit('document.uploaded')  │
│                     │                            │
└─────────────────────┼────────────────────────────┘
                      │
          ════════════╪════════════
          │       Event Bus       │
          ════════════╪════════════
                      │
                      ▼
┌──────────────────────────────────────────────────┐
│       Index Pipeline (独立 Worker, 多 Queue)      │
│                                                  │
│  Queue: index (3 并发)                            │
│  @OnEvent('document.uploaded')                   │
│  IndexProcessor.handle()                         │
│       │                                          │
│       ├── 1. UPDATE document → PROCESSING        │
│       ├── 2. CREATE index_job (PENDING → RUNNING)│
│       ├── 3. MinIO download → file buffer        │
│       │                                          │
│       ├── 4. Loader (格式无关, 策略模式)            │
│       │    ├── PDFLoader  → pages[]              │
│       │    ├── WordLoader → pages[]  (V2.5)      │
│       │    ├── MarkdownLoader → pages[] (V2.5)   │
│       │    ├── ExcelLoader → rows[]   (V2.5)     │
│       │    └── HTMLLoader → text      (V2.5)     │
│       │                                          │
│       ├── 5. Parser (提取纯文本 + 元数据)           │
│       │    └── 结构化 text + page/row metadata    │
│       │                                          │
│       ├── 6. TextSplitter → chunks[]             │
│       │    Update job.progress (0→50%)           │
│       │                                          │
│       ├── 7. Persist: INSERT document_chunks     │
│       │    (batch, 含 parent_chunk_id)           │
│       │    Update job.progress (50→60%)          │
│       │                                          │
│       └── 8. Enqueue → embedding Queue           │
│                                                  │
│  ──────────────────────────────────────────────  │
│                                                  │
│  Queue: embedding (5 并发, ★ 独立 Queue)          │
│  EmbeddingProcessor.handle()                     │
│       │                                          │
│       ├── 9. EmbeddingService.embed(chunks)      │
│       │    Update job.progress (60→95%)          │
│       ├── 10. Persist: INSERT chunk_embeddings   │
│       ├── 11. UPDATE document → READY            │
│       ├── 12. UPDATE job → DONE (progress=100)   │
│       └── 13. INSERT audit_log                   │
│                                                  │
│  设计要点:                                        │
│  - index Queue: 快速处理文档解析, CPU 密集型         │
│  - embedding Queue: 调用外部 API, IO 密集型         │
│  - 两个 Queue 独立扩缩容, 互不阻塞                   │
└──────────────────────────────────────────────────┘
```

### 4.2 队列设计 (增强 — 独立 Queue 粒度)

| Queue | 触发 Event | 用途 | 并发 | 类型 | 阶段 |
|-------|-----------|------|------|------|------|
| `index` | `document.uploaded` | Loader→Parser→Splitter→Persist(chunks) | 3 | CPU 密集型 | V1 |
| `embedding` | `index.chunks_persisted` | Embedding API 调用 → 向量持久化 | 5 | IO 密集型 | V1 |
| `reindex` | `index.requested` | 重新索引已有文档 (复用 index+embedding) | 2 | 混合 | V1 |
| `delete-chunks` | `document.deleted` | 清理 Chunks + 向量 | 2 | IO 密集型 | V1 |
| `cleanup` | `version.deleted` / `document.deleted` | ★ 异步 GC: 软删后清 MinIO + 向量 | 1 | IO 密集型 | V1 |
| `ocr` (后续) | `image.uploaded` | OCR 图片 PDF | 1 | CPU 密集型 | V3 |
| `summary` (后续) | `index.completed` | 生成文档摘要 | 1 | IO 密集型 | V2 |
| `workflow-exec` (V2) | `workflow.execute` | LangGraph Runtime 执行 Workflow | 3 | 混合 | **V2** |
| `tool-exec` (V3) | `tool.execute` | 沙箱执行工具 (SQL/HTTP/Search) | 3 | 混合 | **V3** |

**设计要点:**
- `index` Queue (CPU 密集) 和 `embedding` Queue (IO 密集) 独立扩缩容, 互不阻塞
- `embedding` Queue 并发数设为 5 — Embedding API 有 rate limit, 可通过并发数控制调用频率
- `cleanup` Queue 统一管理所有异步清理任务, 避免与核心业务争抢资源
- 新增格式 (Word/Excel/Markdown) 只需注册 Loader, 无需修改任何队列

### 4.3 软删除 + 异步 GC 策略

```
用户/系统触发删除
       │
       ▼
┌──────────────────────────────────────┐
│  1. API: UPDATE status → DELETED     │  ← 软删, 瞬时完成
│  2. API: eventBus.emit('deleted')    │
│  3. API: 返回 200 OK (不等待清理)      │
└──────────────────┬───────────────────┘
                   │
       ════════════╪═════════════
       │       Event Bus        │
       ════════════╪═════════════
                   │
                   ▼
┌──────────────────────────────────────┐
│  4. GC Worker (clean-orphan-chunks): │
│     ├── DELETE document_chunks       │  ← 批量清向量 (异步)
│     ├── MinIO deleteObjects()        │  ← 清对象存储文件
│     ├── UPDATE version → GC_DONE     │
│     └── INSERT audit_log             │
└──────────────────────────────────────┘

优势: 大文档删除不阻塞 API, 失败可重试, MinIO 误删可恢复(软删窗口期)
```

### 4.4 Workflow Execution Worker (★新增 — V2)

```
Chat / AI Application 发来请求
       │
       ▼
┌──────────────────────────────────────────────────┐
│  1. API: 接收用户消息                              │
│  2. API: 查找 AI Application 配置                 │
│     ├── 绑定 KB → Retrieval Pipeline             │
│     ├── 绑定 Workflow → 选择 Strategy             │
│     └── 绑定 Model + Prompt + Tools              │
│  3. API: eventBus.emit('workflow.execute')       │
└──────────────────┬───────────────────────────────┘
                   │
       ════════════╪═════════════
       │       Event Bus        │
       ════════════╪═════════════
                   │
                   ▼
┌──────────────────────────────────────────────────┐
│  4. Workflow Exec Worker:                        │
│     ├── INSERT workflow_execution (RUNNING)      │
│     ├── LangGraph StateGraph 初始化               │
│     ├── 逐 Node 执行:                             │
│     │   ├── RetrieverNode → KB.search()          │
│     │   ├── LLMNode → ModelService.chat()        │
│     │   ├── ToolNode → ToolExecutor.run()        │
│     │   ├── JudgeNode → Reflection               │
│     │   └── ...                                  │
│     ├── 记录 per-node steps + duration            │
│     ├── UPDATE workflow_execution → DONE         │
│     └── SSE Streaming 返回结果                    │
└──────────────────────────────────────────────────┘
```

### 4.5 Event 类型定义 (增强)

```typescript
enum DocumentEvent {
  DOCUMENT_UPLOADED  = 'document.uploaded',   // → Index Worker
  DOCUMENT_DELETED   = 'document.deleted',    // → Delete-Chunks + GC Worker
  VERSION_DELETED    = 'version.deleted',     // → GC Worker (clean-orphan-chunks)
  INDEX_REQUESTED    = 'index.requested',     // → Reindex Worker
  INDEX_COMPLETED    = 'index.completed',     // → Summary Worker (后续)
  INDEX_FAILED       = 'index.failed',
  IMAGE_UPLOADED     = 'image.uploaded',      // → OCR Worker (后续)
}

// ★ 新增
enum WorkflowEvent {
  WORKFLOW_EXECUTE   = 'workflow.execute',    // → Workflow Exec Worker (V2)
  WORKFLOW_COMPLETED = 'workflow.completed',
  WORKFLOW_FAILED    = 'workflow.failed',
}

enum ToolEvent {
  TOOL_EXECUTE       = 'tool.execute',        // → Tool Exec Worker (V3)
  TOOL_COMPLETED     = 'tool.completed',
  TOOL_FAILED        = 'tool.failed',
}
```

### 4.6 后续升级路径

```
当前: NestJS EventEmitter + BullMQ (同进程 / Redis)
  │
  ├── 第二阶段: RabbitMQ (独立 Broker, 更可靠)
  │
  └── 第三阶段: Kafka + Schema Registry (大规模, 多消费者)
```

---

## 4bis. Redis 缓存分层策略 (★新增 — 并发控制 + 成本优化)

### 4bis.1 缓存分层架构

```
┌──────────────────────────────────────────────────────────┐
│                      Redis (BullMQ + Cache + Lock)        │
│                                                          │
│  ┌─ Layer 1: Session 分布式锁 (Redlock) ──────────────┐  │
│  │  Key:    lock:session:{session_id}                  │  │
│  │  TTL:    30s (自动释放)                              │  │
│  │  用途:   同一 Session 同一时间只允许一个 LLM 请求      │  │
│  │  场景:   用户快速连续点击发送, 防止并发 LLM 调用       │  │
│  └────────────────────────────────────────────────────┘  │
│                                                          │
│  ┌─ Layer 2: Embedding 缓存 ──────────────────────────┐  │
│  │  Key:    embed:{sha256(query)}:{model_name}         │  │
│  │  Value:  vector(float32[])                          │  │
│  │  TTL:    24h (FAQ 问题长期有效)                      │  │
│  │  用途:   重复 Query 直接返回缓存向量, 跳过 API 调用    │  │
│  │  收益:   FAQ 场景 Embedding API 成本降低 60-80%       │  │
│  └────────────────────────────────────────────────────┘  │
│                                                          │
│  ┌─ Layer 3: Retrieval 结果缓存 (可选) ────────────────┐  │
│  │  Key:    retrieval:{kb_id}:{sha256(query)}          │  │
│  │  Value:  chunk_ids[] + scores[]                     │  │
│  │  TTL:    5min (热数据短期有效)                        │  │
│  │  用途:   同 KB 内重复查询直接返回检索结果              │  │
│  └────────────────────────────────────────────────────┘  │
│                                                          │
│  ┌─ Layer 4: Rate Limiter ────────────────────────────┐  │
│  │  Key:    rate:{user_id}:{endpoint}                  │  │
│  │  算法:   Sliding Window Log                          │  │
│  │  用途:   用户级/API Key 级频率限制                    │  │
│  └────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────┘
```

### 4bis.2 Session 分布式锁流程

```
用户发送消息 (session_id = "abc123")
       │
       ▼
┌──────────────────────────────────────┐
│  1. Redis: SET lock:session:abc123   │
│            NX PX 30000 (30s TTL)     │
│       │                              │
│       ├── OK (获取锁成功) → 继续执行   │
│       │                              │
│       └── nil (锁已被持有) → 返回     │
│           HTTP 429 "上一个问题正在处理中"│
└──────────────────┬───────────────────┘
                   │
                   ▼
┌──────────────────────────────────────┐
│  2. 执行完整 RAG Pipeline             │
│     Retriever → Rerank → LLM → SSE   │
└──────────────────┬───────────────────┘
                   │
                   ▼
┌──────────────────────────────────────┐
│  3. Redis: DEL lock:session:abc123   │
│     (或等 30s TTL 自动过期)           │
└──────────────────────────────────────┘

优势: 用户快速连点发送按钮不会产生多个并发 LLM 调用, 节省 Token 成本
```

### 4bis.3 Embedding 缓存流程

```
用户 Query: "请假流程是什么?"
       │
       ▼
┌──────────────────────────────────────┐
│  1. hash = SHA256("请假流程是什么?")   │
│     key = "embed:{hash}:bge-m3"      │
└──────────────────┬───────────────────┘
                   │
                   ▼
┌──────────────────────────────────────┐
│  2. Redis: GET embed:{hash}:bge-m3   │
│       │                              │
│       ├── HIT → 直接返回缓存向量       │
│       │        跳过 Embedding API 调用 │
│       │                              │
│       └── MISS → Embedding API       │
│                  → Redis SETEX 24h   │
└──────────────────────────────────────┘

收益分析:
  - Embedding API 调用减少 60-80% (FAQ/重复场景)
  - 用户感知延迟降低 ~200ms (网络 RTT)
  - 缓存 Key 设计: 包含 model_name, 不同模型独立缓存
```

---

## 5. Retrieval Pipeline (Query 侧核心链路 — 分层抽象: Vector Search → Rerank → Citation → Return)

### 5.0 分层设计理念 (★)

```
Retrieval Pipeline 不是单一 Retriever, 而是可组合的分层架构:

┌─────────────────────────────────────────────┐
│  Layer 1: Vector Search                     │
│  ├── DenseRetriever  (pgvector HNSW)        │
│  ├── SparseRetriever (BM25 tsvector)        │
│  └── RRF Fusion                             │
│      ↓                                      │
│  Layer 2: Rerank (精排, 可选)                │
│  ├── BGE-Reranker                           │
│  └── Cohere Rerank                          │
│      ↓                                      │
│  Layer 3: Citation (引用生成)                │
│      ↓                                      │
│  Layer 4: Return (结果返回)                  │
└─────────────────────────────────────────────┘

以后增加 Hybrid Search / 更换 Reranker:
  不用修改任何上层代码, 只需替换 Layer 实现
```

### 5.1 双路召回 + RRF 融合架构

```
                       用户问题
                          │
                          ▼
┌──────────────────────────────────────────────────────────┐
│  1. Query Rewrite (可选)                                  │
│     "请假流程" → ["员工请假流程", "请假申请步骤"]             │
└──────────────────────────┬───────────────────────────────┘
                           │
              ┌────────────┴────────────┐
              ▼                         ▼
┌──────────────────────┐   ┌──────────────────────┐
│ 2a. DenseRetriever   │   │ 2b. SparseRetriever  │
│ (Vector / pgvector)  │   │ (BM25 / tsvector)    │
│ HNSW 索引            │   │ PostgreSQL 全文搜索    │
│ TopK=20 (语义相似)    │   │ TopK=20 (关键词匹配)   │
│ kb_ids 过滤 + RLS    │   │ kb_ids 过滤 + RLS     │
└──────────┬───────────┘   └──────────┬───────────┘
           │                          │
           └──────────┬───────────────┘
                      ▼
┌──────────────────────────────────────────────────────────┐
│  3. RRF (Reciprocal Rank Fusion) 融合                    │
│     score(d) = Σ 1/(k + rank_i(d))                      │
│     两路 Top20 → 融合排序 → Top20 (去重 + 重排)             │
└──────────────────────────┬───────────────────────────────┘
                           │
                           ▼
┌──────────────────────────────────────────────────────────┐
│  4. Reranker (精排)                                      │
│     BGE-Reranker / Cohere / cross-encoder                │
│     Top20 → Top5                                         │
│     仅在 retrieval_strategy='hybrid' 或 rerank.enabled   │
└──────────────────────────┬───────────────────────────────┘
                           │
                           ▼
┌──────────────────────────────────────────────────────────┐
│  5. Citation Generator                                   │
│     {document_name, page, version, snippet, score}       │
│     SSE Event: citations (在回答前优先吐出)                 │
└──────────────────────────┬───────────────────────────────┘
                           │
                           ▼
┌──────────────────────────────────────────────────────────┐
│  6. Prompt Template 渲染                                  │
│     {{context}} ← Top5 Chunks + Citations                │
│     {{question}} ← 用户问题                               │
│     {{history}} ← 对话历史                                │
└──────────────────────────┬───────────────────────────────┘
                           │
                           ▼
┌──────────────────────────────────────────────────────────┐
│  7. LLM (SSE Streaming)                                  │
│     SSE Events: step → citations → delta* → done         │
│     支持 AbortController 中途终止                          │
└──────────────────────────────────────────────────────────┘
```

### 5.2 模块拆分 (Retrieval Module)

```
retrieval/
├── retrieval.module.ts
├── retrieval.controller.ts
├── retrieval.service.ts          # 编排: 双路召回 → RRF → Reranker
│
├── retrievers/
│   ├── base-retriever.ts         # 抽象基类
│   ├── dense-retriever.ts        # Vector / pgvector HNSW
│   └── sparse-retriever.ts       # BM25 / PostgreSQL tsvector
│
├── fusion/
│   └── rrf.service.ts            # Reciprocal Rank Fusion
│
├── reranker/
│   ├── reranker.interface.ts
│   ├── bge-reranker.service.ts
│   └── cohere-reranker.service.ts
│
├── citation/
│   └── citation.service.ts
│
└── dto/
    └── search.dto.ts
```

### 5.3 配置项 (per Knowledge Base)

| 配置 | 默认值 | 说明 |
|------|--------|------|
| `retrieval.strategy` | `vector` | `vector`=纯向量, `hybrid`=BM25+Vector+RRF |
| `retrieval.denseTopK` | 20 | DenseRetriever 粗排数量 |
| `retrieval.sparseTopK` | 20 | SparseRetriever 粗排数量 |
| `retrieval.rrf_k` | 60 | RRF 融合参数 |
| `rerank.enabled` | false | 是否启用 Reranker (hybrid 模式默认开启) |
| `rerank.topK` | 5 | Reranker 精排后数量 |
| `rerank.model` | `bge-reranker-v2-m3` | Rerank 模型 |
| `query_rewrite.enabled` | false | 是否启用多 Query |
| `query_rewrite.count` | 3 | 生成 Query 数量 |

### 5.4 Parent-Child Chunking 策略 (★新增 — 召回增强)

```
传统 RAG 困境:
  - 小 Chunk (256 token): 向量匹配精度高, 但上下文片段不完整, LLM 理解困难
  - 大 Chunk (1024 token): 上下文完整, 但语义被稀释, 向量匹配精度下降

解决方案: Parent-Child Chunking (双层分块)

  ┌─────────────────────────────────────────────────────┐
  │              Document (PDF / Word / ...)            │
  └────────────────────────┬────────────────────────────┘
                           │
                           ▼
  ┌─────────────────────────────────────────────────────┐
  │  1. Large Chunk (Parent) = 1024 tokens             │
  │     ├── Parent A: "员工手册第1章..."                 │
  │     ├── Parent B: "员工手册第2章..."                 │
  │     └── Parent C: "员工手册第3章..."                 │
  │                                                    │
  │  2. Small Chunk (Child) = 256 tokens               │
  │     ├── Child A1 (→ Parent A)                      │
  │     ├── Child A2 (→ Parent A)                      │
  │     ├── Child B1 (→ Parent B)                      │
  │     └── ...                                        │
  └─────────────────────────────────────────────────────┘
                           │
                           ▼
  ┌─────────────────────────────────────────────────────┐
  │  检索流程:                                           │
  │  1. 用户 Query → Embedding → 向量检索 (Child)         │
  │     → 命中 Child A1, Child B1 (小 Chunk 精确匹配)     │
  │                                                    │
  │  2. parent_chunk_id → 获取 Parent A, Parent B       │
  │     → 大 Chunk 作为 LLM 上下文 (完整语境)             │
  │                                                    │
  │  3. 去重后 Prompt: <Parent A 全文> <Parent B 全文>    │
  └─────────────────────────────────────────────────────┘

数据库支持:
  document_chunks.parent_chunk_id → document_chunks.id
  子 Chunk (parent_chunk_id IS NOT NULL)   → 用于向量检索
  父 Chunk (parent_chunk_id IS NULL)       → 作为 LLM 上下文
```

### 5.5 配置项 (per Knowledge Base) — 增加 Parent-Child

| 配置 | 默认值 | 说明 |
|------|--------|------|
| `chunk.parent_size` | 1024 | 父 Chunk 大小 (tokens) |
| `chunk.child_size` | 256 | 子 Chunk 大小 (tokens) |
| `chunk.parent_overlap` | 100 | 父 Chunk 重叠 |
| `chunk.child_overlap` | 50 | 子 Chunk 重叠 |
| `retrieval.childTopK` | 20 | 子 Chunk 粗排数量 |
| `retrieval.parentTopK` | 5 | 去重后父 Chunk 作为上下文的数量 |

---

## 6. AI Application 层 (★ V2 核心新增)

### 6.1 AI Application = KB + Workflow + Model + Prompt + Tools

```
┌──────────────────────────────────────────────────────────┐
│                    AI Application                         │
│                                                          │
│  id: "finance-assistant"                                │
│  name: "财务助手"                                         │
│  description: "解答财务制度相关问题"                       │
│                                                          │
│  ┌────────────────────────────────────────────────────┐  │
│  │  绑定资源:                                          │  │
│  │                                                    │  │
│  │  📚 Knowledge Base: 财务制度 (ID: kb-finance)       │  │
│  │  🔄 Workflow:        Reflection RAG (ID: wf-ref)    │  │
│  │  🤖 Model:           DeepSeek-V3 (ID: model-ds)     │  │
│  │  📝 Prompt:          财务助手 Prompt v3              │  │
│  │  🔧 Tools:           [SQL查询] [计算器]              │  │
│  └────────────────────────────────────────────────────┘  │
│                                                          │
│  用户视角: 打开 "财务助手" 直接对话                        │
│  而不是: 选择 KB → 选 Workflow → 选 Model → 开始对话     │
└──────────────────────────────────────────────────────────┘
```

### 6.2 AI Application 与 Chat 的关系

```
用户
 │
 ├── 方式 1 (V1): 直接 Chat → 手动选 KB + Workflow
 │
 └── 方式 2 (V2): 打开 AI Application → 自动加载绑定配置 → Chat
                   │
                   chat_sessions.ai_application_id → AI Application
                   → 自动解析: kb_id, workflow_id, model_id, prompt_id, tool_ids
```

### 6.3 模块拆分

```
ai-application/
├── ai-application.module.ts
├── ai-application.controller.ts
├── ai-application.service.ts       # CRUD + 资源绑定
├── dto/
│   ├── create-ai-app.dto.ts
│   └── update-ai-app.dto.ts
└── entities/
    └── ai-application.entity.ts
```

---

## 7. Model Center (★ V2)

### 7.1 模型注册中心

```
┌──────────────────────────────────────────────────────────┐
│                     Model Center                          │
│                                                          │
│  统一管理平台所有可用模型, 按 type 分类:                      │
│                                                          │
│  ┌─ Chat Models ─────────────────────────────────────┐  │
│  │  OpenAI/gpt-4o    DeepSeek/deepseek-chat          │  │
│  │  Qwen/qwen-turbo  Anthropic/claude-opus-4-8       │  │
│  └───────────────────────────────────────────────────┘  │
│                                                          │
│  ┌─ Embedding Models ────────────────────────────────┐  │
│  │  OpenAI/text-embedding-3-small  (1536d)           │  │
│  │  OpenAI/text-embedding-3-large  (3072d)           │  │
│  │  BGE/bge-m3                     (1024d)           │  │
│  └───────────────────────────────────────────────────┘  │
│                                                          │
│  ┌─ Rerank Models ───────────────────────────────────┐  │
│  │  Cohere/rerank-v3   BGE/bge-reranker-v2-m3        │  │
│  └───────────────────────────────────────────────────┘  │
│                                                          │
│  models.api_key_id → api_keys (凭证解耦)                  │
└──────────────────────────────────────────────────────────┘
```

### 7.2 Model vs API Key 的关系

```
api_keys:       凭证层 — 存储 Provider 的 API 密钥
models:         注册层 — 描述 Provider 下有哪些可用模型

示例:
  api_keys: { provider: "openai", api_key: "sk-xxx..." }
  models:   { provider: "openai", model_name: "gpt-4o", type: "chat", api_key_id → api_keys.id }
  models:   { provider: "openai", model_name: "text-embedding-3-small", type: "embedding", api_key_id → api_keys.id }

一个 api_key 可被多个 model 引用 (同一 Provider 下的不同模型)
```

### 7.3 模块拆分

```
model/
├── model.module.ts
├── model.controller.ts
├── model.service.ts                # CRUD + provider 校验
├── dto/
│   ├── create-model.dto.ts
│   └── update-model.dto.ts
└── entities/
    └── model.entity.ts
```

---

## 8. Tool Center (★ V3)

### 8.1 工具注册与执行

```
┌──────────────────────────────────────────────────────────┐
│                      Tool Center                          │
│                                                          │
│  ┌─ SQL ──────────────────────────────────────────────┐ │
│  │  Name: postgres_query                              │ │
│  │  Config: { connection: "...", maxRows: 100 }        │ │
│  │  执行: 沙箱 SQL → 结果集 → LLM                      │ │
│  └───────────────────────────────────────────────────┘  │
│                                                          │
│  ┌─ HTTP ─────────────────────────────────────────────┐ │
│  │  Name: weather_api                                 │ │
│  │  Config: { url: "https://...", method: "GET" }      │ │
│  │  执行: HTTP Request → JSON → LLM                    │ │
│  └───────────────────────────────────────────────────┘  │
│                                                          │
│  ┌─ Search ───────────────────────────────────────────┐ │
│  │  Name: web_search                                  │ │
│  │  Config: { engine: "tavily", api_key_id: "..." }    │ │
│  └───────────────────────────────────────────────────┘  │
│                                                          │
│  ┌─ Function ─────────────────────────────────────────┐ │
│  │  Name: calculator                                  │ │
│  │  Config: { type: "builtin" }                       │ │
│  └───────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────┘
```

### 8.2 Tool 执行安全模型

```
Tool Execution Worker (独立进程, 沙箱隔离)
  │
  ├── SQL:    只读连接 + 行数限制 + 超时 5s
  ├── HTTP:   白名单域名 + 超时 10s
  ├── Search: 委托给 Tavily/SerpAPI
  └── Function: builtin 函数 (计算器/日期等), 无外部调用

安全措施:
  - Tool Exec Worker 独立进程, 与 API 隔离
  - SQL 工具: 只读用户, 禁止 DDL/DML
  - HTTP 工具: 域名白名单, TLS 强制
  - 所有工具: 输入大小限制, 输出大小限制, 超时限制
```

### 8.3 模块拆分

```
tool/
├── tool.module.ts
├── tool.controller.ts
├── tool.service.ts                # CRUD + 工具注册
├── tool-executor.service.ts       # 工具执行器 (沙箱)
├── providers/
│   ├── tool-executor.interface.ts
│   ├── sql-executor.ts
│   ├── http-executor.ts
│   ├── search-executor.ts
│   └── function-executor.ts
├── dto/
│   ├── create-tool.dto.ts
│   └── tool-result.dto.ts
└── entities/
    └── tool.entity.ts
```

---

## 9. Workflow 模块 (增强 — Nodes + Edges + Execution)

### 9.1 策略模式设计

```
┌─────────────────────────────────────────────────┐
│               Chat Session                       │
│          workflow_type = "rewoo"                 │
└──────────────────────┬──────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────┐
│           WorkflowStrategyFactory                │
│                                                 │
│  workflow_type ──► strategy                      │
│    "rag"       → RagStrategy                     │
│    "reflection"→ ReflectionStrategy               │
│    "rewoo"     → ReWooStrategy                   │
│    "multi_agent"→ MultiAgentStrategy             │
└──────────────────────┬──────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────┐
│         IWorkflowStrategy.execute()              │
│                                                 │
│  input: { question, chat_history, kb_ids,        │
│           prompt_template, session_id }         │
│  output: SSE Stream { answer, citations, ... }   │
└─────────────────────────────────────────────────┘
```

### 9.2 Workflow 图结构 (★ V2 增强 — 为 V3 Designer 预留)

```
workflows 表
  │
  ├── workflow_nodes (图节点)
  │     id, workflow_id, type (retriever|llm|tool|condition|start|end),
  │     label, position_x, position_y, config (JSONB)
  │
  ├── workflow_edges (图边)
  │     id, workflow_id, source_node_id, target_node_id,
  │     source_handle, target_handle, label, condition (JSONB)
  │
  └── workflow_executions (执行记录) ★
        id, workflow_id, application_id, session_id,
        input (JSONB), output (JSONB), status, duration_ms,
        error_message, node_steps (JSONB)
```

### 9.3 Workflow Execution 流程追踪

```
workflow_executions.node_steps (JSONB):

[
  {
    "node_id": "retriever-1",
    "node_type": "retriever",
    "status": "completed",
    "input": {"query": "请假流程", "kb_ids": ["uuid-hr"]},
    "output": {"chunks_count": 20, "top_score": 0.92},
    "duration_ms": 350,
    "started_at": "2026-07-22T14:30:00Z",
    "completed_at": "2026-07-22T14:30:00Z"
  },
  {
    "node_id": "llm-1",
    "node_type": "llm",
    "status": "completed",
    "input": {"prompt_tokens": 1200},
    "output": {"completion_tokens": 250},
    "duration_ms": 1800,
    "started_at": "2026-07-22T14:30:00Z",
    "completed_at": "2026-07-22T14:30:02Z"
  },
  {
    "node_id": "judge-1",
    "node_type": "reflection",
    "status": "completed",
    "input": {"answer": "根据员工手册...", "citations": [...]},
    "output": {"verdict": "good", "needs_improvement": false},
    "duration_ms": 1200
  }
]
```

### 9.4 各 Workflow 类型

| Type | 流程 | 适用场景 |
|------|------|---------|
| `rag` | Query → Retriever → Rerank → Prompt → LLM | 标准 RAG 问答 |
| `reflection` | Retriever → Judge → (不够好)→ 重新检索 → LLM | 需要自我反思的复杂问题 |
| `rewoo` | Planner → Worker(Retriever) → Solver → Answer | 多步骤推理 |
| `multi_agent` | Planner → Retriever ∥ Summarizer → Aggregator → Answer | 多 Agent 协作 |

### 9.4b Workflow 状态机与 Human-in-the-loop (★新增)

```
execution_status 状态流转:

                    ┌─────────────────────────────┐
                    │         RUNNING             │
                    │  (Workflow Exec Worker 执行) │
                    └──────────┬──────────────────┘
                               │
              ┌────────────────┼────────────────┐
              │                │                │
              ▼                ▼                ▼
        ┌──────────┐   ┌──────────┐    ┌──────────────┐
        │COMPLETED │   │  FAILED  │    │   PAUSED     │
        │ (成功)    │   │ (失败)   │    │ (暂停,可恢复)  │
        └──────────┘   └──────────┘    └──────┬───────┘
                                              │
                            ┌─────────────────┤
                            │                 │
                            ▼                 ▼
                     ┌──────────┐    ┌──────────────┐
                     │ RUNNING  │    │   WAITING    │
                     │ (恢复执行)│    │ (等待外部输入) │
                     └──────────┘    │ 如: 人工审批   │
                                     └──────┬───────┘
                                            │
                                    收到外部输入
                                            │
                                            ▼
                                     ┌──────────┐
                                     │ RUNNING  │
                                     │ (继续执行)│
                                     └──────────┘
```

**状态说明:**

| 状态 | 含义 | 触发条件 |
|------|------|---------|
| `RUNNING` | 执行中 | Workflow Exec Worker 开始处理 |
| `COMPLETED` | 成功完成 | 所有 Node 执行完毕, End 节点到达 |
| `FAILED` | 执行失败 | Node 抛出异常且不可重试 |
| `CANCELLED` | 用户取消 | 用户点击 Stop / AbortController |
| `PAUSED` | 暂停(可恢复) | 系统主动暂停或 debug 断点 |
| `WAITING` | 等待外部输入 | Human-in-the-loop: 人工审批/确认节点 |

**Human-in-the-loop 场景示例:**

```
Reflection Workflow with Human Approval:

  Start → Retriever → LLM → Judge
                              │
                    ┌─────────┴─────────┐
                    │                   │
                    ▼                   ▼
              (质量达标)           (需要改进)
                    │                   │
                    ▼                   ▼
            ┌──────────────┐    ┌──────────────┐
            │ Human Review │    │ Re-retrieve  │
            │ Node         │    │ + Regenerate │
            │ (WAITING)    │    └──────────────┘
            └──────┬───────┘
                   │
          人工审批结果 (通过/驳回)
                   │
          ┌────────┴────────┐
          │                 │
          ▼                 ▼
      COMPLETED          重新生成
```

**断点恢复机制:**

```
workflow_executions 表断点数据:

node_steps (JSONB) — 记录每个 Node 的完整快照:
[
  {"node_id": "retriever-1", "status": "completed", "output": {...}, "duration_ms": 350},
  {"node_id": "llm-1", "status": "completed", "output": {...}, "duration_ms": 1800},
  {"node_id": "human-review-1", "status": "waiting", "output": null}
]

恢复执行:
  1. 读取 node_steps 最后一条 completed 的 Node
  2. 从 WAITING Node 继续执行
  3. 将 WAITING → RUNNING → COMPLETED
  4. 追加新的 node_steps 记录

Worker 重启安全:
  - PAUSED/WAITING 状态的 execution 在 Worker 重启后不会自动重试
  - 需要外部 API 调用 POST /workflows/:id/executions/:execId/resume 触发恢复
```

### 9.4c Token 计量与成本核算 (★新增)

```
┌──────────────────────────────────────────────────────────┐
│                   Token 计量体系                           │
│                                                          │
│  数据来源: chat_messages                                  │
│  ┌────────────────────────────────────────────────────┐  │
│  │ prompt_tokens     │ 输入 Token (检索结果+历史+Prompt) │  │
│  │ completion_tokens │ 输出 Token (LLM 生成内容)        │  │
│  │ total_tokens      │ = prompt + completion          │  │
│  └────────────────────────────────────────────────────┘  │
│                                                          │
│  核算维度:                                                │
│  ┌──────────┬─────────────────────────────────────────┐  │
│  │ 用户级   │ 每个用户一段时间内的 Token 消耗              │  │
│  │ 应用级   │ 每个 AI Application 的总消耗               │  │
│  │ 模型级   │ 每个 Model (GPT-4o vs DeepSeek) 的消耗     │  │
│  │ Session级│ 单次对话 Session 的 Token 消耗             │  │
│  └──────────┴─────────────────────────────────────────┘  │
│                                                          │
│  成本计算 = Σ (model_price_per_token × token_count)       │
│                                                          │
│  集成点:                                                  │
│  - LLMNode (Workflow 执行): 调用 LLM 后回写 Token 统计      │
│  - ChatService: SSE Streaming 结束后汇总 Token             │
│  - Dashboard: Token 消耗趋势图 + Top 应用/用户 排名          │
└──────────────────────────────────────────────────────────┘
```

### 9.5 Chat SSE 标准化协议

```
SSE Event 类型 (text/event-stream):

event: step
data: {"type": "retrieving", "message": "正在检索 HR 知识库...", "kb_ids": ["uuid1"]}

event: step
data: {"type": "reranking", "message": "正在精排 20 条结果..."}

event: citations
data: [{"chunk_id": "...", "document_name": "员工手册.pdf", "page": 12, "snippet": "员工请假需提前...", "score": 0.92}]

event: delta
data: {"content": "根据员工手册，"}

event: delta
data: {"content": "请假流程如下..."}

event: done
data: {"usage": {"prompt_tokens": 450, "completion_tokens": 120}, "citations": [...]}

event: error
data: {"code": "RETRIEVAL_FAILED", "message": "知识库索引不可用"}

---

前端消费 (Vue 3 + fetch + SSE):

// Vue 3 composable: useChat() 
// 使用 fetch + ReadableStream 消费 SSE
// 解析 step/citations/delta/error/done 事件
// 用户点击 Stop → AbortController.abort() → 后端感知断开
```

### 9.6 用户反馈

```
POST /api/v1/chat/messages/:id/feedback
body: { rating: "like" | "dislike", comment: "..." }
→ INSERT audit_logs (action=CHAT_FEEDBACK)
→ 可选: 存储到 chat_messages.metadata
```

---

## 10. Docker 部署拓扑

```yaml
services:
  frontend:      # Vue 3 + Vite (Nginx, port 80)
  backend:       # NestJS API (port 3001)
  worker:        # NestJS Worker (no port, 消费 BullMQ)
  workflow-exec:# ★ Workflow Execution Worker (no port, V2)
  tool-exec:     # ★ Tool Execution Worker (no port, V3)
  postgres:      # PostgreSQL + pgvector (port 5432)
  redis:         # Redis — BullMQ + Cache + Session (port 6379)
  minio:         # MinIO (port 9000, 9001)
```

### 10.1 端口规划

| 服务 | 端口 | 说明 |
|------|------|------|
| Frontend (Dev) | 3034 | Vite dev server |
| Frontend (Prod) | 80 | Nginx (SPA) |
| Backend API | 3001 | NestJS HTTP |
| PostgreSQL | 5432 | 数据库 |
| Redis | 6379 | 队列 + 缓存 |
| MinIO API | 9000 | S3 兼容 |
| MinIO Console | 9001 | Web 管理 |

---

## 11. 版本演进路线 (更新)

### 11.1 平台级路线

| 阶段 | 定位 | 核心能力 | 新增模块 |
|------|------|---------|---------|
| **V1: Knowledge Platform** | 知识资产管理 | Knowledge Base, Document/Version/Chunk, Index Pipeline, RAG Chat | Auth, KB, Document, Chunk, Embedding, Retrieval, Chat, Prompt, Audit, API Key |
| **V2: AI Application Platform** | 应用编排层 | AI Application = KB + Workflow + Model + Prompt 绑定, Workflow Execution 追踪 | **AI Application, Model Center**, Workflow 增强 (Nodes+Edges+Execution) |
| **V3: Agent Platform** | Agent 运行时 | Tool Center, Workflow Designer (Vue Flow), Multi-Agent, MCP | **Tool Center**, Workflow Designer, MCP Gateway |
| **V4: Enterprise AI Hub** | 企业 AI 中台 | 多租户, SSO, 计费, 监控, 高可用 | Tenant, SSO, Billing, Observability |

### 11.2 细粒度版本

| 版本 | 功能 | 新增 |
|------|------|------|
| v1.0 | PDF → Embedding → Retriever → RAG Chat | LangChain Loader/Splitter/Embedding, SSE Chat |
| v1.5 | Document Version, Index Job 进度, Prompt Template | version 表, job progress, prompt_templates |
| v2.0 | AI Application 编排, Model Center, Workflow 增强 | ai_applications, models, workflow_nodes/edges/executions |
| v2.5 | Word/Excel/Markdown 支持, Workflow Execution 追踪 | 多格式 Loader, workflow_executions |
| v3.0 | OCR / 图片 PDF, Tool Center (SQL/HTTP/Search) | Tesseract.js, tools 表, Tool Exec Worker |
| v3.5 | Workflow Designer (拖拽可视化编辑) | Vue Flow, workflow_nodes/edges 前端编辑器 |
| v4.0 | Hybrid Search (BM25 + Vector), Rerank | PostgreSQL 全文搜索, BGE-Reranker / Cohere |
| v4.5 | Multi-Agent, Reflection, ReWOO | LangGraph Multi-Agent Strategies |
| v5.0 | Knowledge Graph | Neo4j / NebulaGraph |
| v5.5 | MCP Gateway, Tool Marketplace | MCP Server/Client, Tool 生态 |
| v6.0 | 多租户, SSO, 企业级高可用 | Tenant isolation, OIDC, K8s HA |

### 11.3 V1 开发范围 (当前阶段)

```
V1 必须完成:
  ✅ Knowledge Base CRUD (含 Permission/RBAC)
  ✅ Document Upload + Version 管理
  ✅ Index Pipeline (PDF → Parse → Split → Embedding → pgvector)
  ✅ Index Job 监控 (进度 + 重试)
  ✅ RAG Chat (Session + Citation + SSE Streaming)
  ✅ Prompt Template 管理 (版本化)
  ✅ API Key 管理 (Provider + Model)
  ✅ Audit Log 完整记录
  ✅ System Settings (JSONB 配置)

V1 架构预留 (数据库建表, 代码不做):
  ⏸ ai_applications (表已建, Service 空实现)
  ⏸ models (表已建, Service 空实现)
  ⏸ workflow_nodes / workflow_edges / workflow_executions (表已建, V2 启用)
  ⏸ tools (表已建, V3 启用)
```

---

## 12. 架构全景图 (最终目标)

```
                         ┌──────────────────┐
                         │  Vue 3 前端       │
                         │ Enterprise Console│
                         └────────┬─────────┘
                                  │
              ┌───────────────────┼───────────────────┐
              │                   │                   │
    ┌─────────┴─────────┐ ┌──────┴──────┐ ┌─────────┴─────────┐
    │  AI Application   │ │  Knowledge  │ │  Administration   │
    │  Center (V2)      │ │  Center (V1)│ │  (V1)             │
    │                   │ │             │ │                   │
    │ • App 管理         │ │ • KB 管理   │ │ • User & RBAC     │
    │ • Workflow 编排    │ │ • Document  │ │ • Audit Log       │
    │ • Model 选择       │ │ • Version   │ │ • Settings        │
    │ • Prompt 绑定      │ │ • Chunk     │ │ • API Keys        │
    │ • Tool 挂载        │ │ • Embedding │ │                   │
    └─────────┬─────────┘ └───────┬─────┘ └───────────────────┘
              │                   │
              └─────────┬─────────┘
                        │
              ┌─────────┴─────────┐
              │   NestJS API      │
              │   + Event Bus     │
              └─────────┬─────────┘
                        │
        ┌───────────────┼───────────────┐
        │               │               │
  ┌─────┴─────┐  ┌──────┴──────┐  ┌─────┴─────┐
  │ LangGraph │  │  Retrieval  │  │  Worker   │
  │ Runtime   │  │  Pipeline   │  │  Cluster  │
  │ (V2)      │  │  (V1)       │  │  (V1-V3)  │
  └─────┬─────┘  └──────┬──────┘  └─────┬─────┘
        │               │               │
        └───────────────┼───────────────┘
                        │
        ┌───────────────┼───────────────┐
        │               │               │
  ┌─────┴─────┐  ┌──────┴──────┐  ┌─────┴─────┐
  │PostgreSQL │  │   MinIO     │  │   Redis   │
  │+ pgvector │  │  (S3)       │  │  (BullMQ) │
  └───────────┘  └─────────────┘  └───────────┘
```

**核心设计理念:**

> **Knowledge Base 是整个平台的数据资产核心。**
> **AI Application 是面向用户的产品形态。**
> **Workflow + Model + Prompt + Tool 是 AI Application 的可编排组件。**
> **架构预留 ≠ 当前实现。V1 聚焦 Knowledge Base + RAG Chat，V2 扩展 AI Application + Model + Workflow，V3 扩展 Tool + Designer + MCP。**
