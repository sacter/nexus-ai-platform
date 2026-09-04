# NexusAI Workflow Engine 设计

> LangChain + LangGraph + DeepAgents 三框架集成设计
> 覆盖 workflow_nodes / workflow_edges / workflow_executions 完整链路
> 最后更新: 2026-09-01（优化版 v2）

---

## 1. 设计概览

### 1.1 目标

在现有 NestJS + Prisma + LangChain 生态基础上，构建一个**可编排、可追踪、可扩展**的 Workflow 执行引擎。

- **代码驱动拓扑**（你选的 B）：每个 Workflow 的图结构由策略代码定义，DB 只存参数配置
- **节点可复用**：所有节点实现集中注册，策略从注册表取节点组装
- **执行可追踪**：`workflow_executions.node_steps` 记录每一步的输入/输出/耗时
- **DB Schema 兼容 V3 Designer**：`workflow_nodes`/`workflow_edges` 同时支持 V2 代码驱动和 V3 拖拽编辑

### 1.2 三框架定位

| 框架 | 层 | 职责 |
|---|---|---|
| **LangChain** | 基础组件层 | 模型调用（`ChatModel`）、工具定义（`BaseTool`）、提示词模板、检索器接口 |
| **LangGraph** | 图执行引擎层 | `StateGraph` 构建、状态管理、边路由、流式执行、检查点 |
| **DeepAgents** | 高级 Agent Harness | 规划/子Agent/文件系统/记忆/技能中间件（仅 ReWOO/Multi-Agent 等复杂策略使用） |

### 1.3 五层架构

```
┌──────────────────────────────────────────────────────────────────────┐
│  Layer 1: LangGraph Runtime  (底层图执行引擎)                          │
│     @langchain/langgraph: StateGraph / CompiledStateGraph /          │
│     addNode / addEdge / addConditionalEdges / stream / interrupt     │
├──────────────────────────────────────────────────────────────────────┤
│  Layer 2: Node Registry  (节点实现 — 注册表管理)                        │
│     GraphNode 接口 + 11 种内置节点 + 注册/发现/组合                      │
│     横切：日志/审计/Token 计量（通过 onStep 回调传给 ExecutionService）   │
├──────────────────────────────────────────────────────────────────────┤
│  Layer 3: Strategy-Defined Graph  (拓扑定义 — 代码驱动)                │
│     RagStrategy / ReflectionStrategy / ReWooStrategy / MultiAgent    │
│     CustomGraphStrategy (V3 Designer)                               │
│     每个策略 = 一个 LangGraph StateGraph + 参数注入                    │
│     策略通过注册表模式自注册，非 switch-case 硬编码                       │
├──────────────────────────────────────────────────────────────────────┤
│  Layer 4: Execution Runtime  (生命周期/持久化/流式/中止/审计)            │
│     WorkflowExecutionService — 创建执行记录 → LangGraph stream →      │
│     内存累积 node_steps → 批量写入（每 N 步或 completed/failed）→        │
│     SSE 推前端 → COMPLETED/FAILED                                     │
├──────────────────────────────────────────────────────────────────────┤
│  Layer 5: DeepAgents Harness  (规划/子Agent/记忆/技能 — 仅复杂策略)      │
│     createDeepAgent({ model, tools, middleware: [planning, ...] })   │
│     注意: JS 版 deepagents 可能不成熟，V3+ 需验证可行性；                 │
│     不可用则降级为纯 LangGraph 实现或python实现（Plan B）                 │
└──────────────────────────────────────────────────────────────────────┘
```

### 1.4 两阶段兼容设计

| 模式 | `workflows.type` | 拓扑定义 | `workflow_nodes/edges` | `edges.condition` |
|------|-----------------|---------|----------------------|------------------|
| **A: 内置策略 (V2)** | `rag` / `reflection` / `rewoo` / `multi_agent` | 策略代码定义 | 可选（自动同步，供前端展示） | 不使用（条件在代码中表达）|
| **B: 自定义策略 (V3)** | `custom` | DB 存储 + Designer 拖拽 | 必须 | 用于条件路由 |

两种模式共享 Execution 层和 Node Registry。

```
                         ┌───────────────────┐
                         │  POST /:id/run    │
                         └────────┬──────────┘
                                  │
                         ┌────────┴──────────┐
                         │   StrategyFactory │
                         │    注册表模式分派   │
                         └────────┬──────────┘
                                  │
              ┌───────────────────┼───────────────────┐
              │                   │                   │
     ┌────────┴────────┐   ┌──────┴──────┐   ┌────────┴────────┐
     │ type='rag'      │   │ type='...'  │   │ type='custom'   │
     │ → RagStrategy   │   │ → 其他策略   │   │ → CustomStrategy│
     │ 代码定义拓扑      │   │  代码定义    │   │  DB 编译拓扑     │
     └────────┬────────┘   └──────┬──────┘   └────────┬────────┘
              │                   │                   │
              └───────────────────┼───────────────────┘
                                  │
                         ┌────────┴─────────────┐
                         │  ExecutionService    │
                         │  ① 创建 execution    │
                         │  ② 调 strategy.run   │
                         │  ③ LangGraph stream │
                         │  ④ 内存累积 steps    │
                         │  ⑤ 批量写 DB + SSE   │
                         │  ⑥ COMPLETED/FAILED │
                         └──────────────────────┘
```

---

## 2. Layer 1: LangGraph Runtime

### 2.1 安装依赖

```json
// apps/api/package.json（注意：依赖安装在 apps/api，非 packages/ai-core）
{
  "dependencies": {
    "@langchain/langgraph": "^1.2.0",
    "@langchain/core": "^0.3.0",
    "@langchain/langchain": "^0.3.0"
  }
}
```

> **设计决策**: LangGraph 依赖安装在 `apps/api` 而非 `packages/ai-core`。
> `ai-core` 保持纯协议层（零运行时依赖，只用原生 fetch），不引入框架级依赖。
> LangGraph 的 StateGraph/RunnableConfig 等类型仅在 API 侧使用。

### 2.2 AgentState 定义

```typescript
// apps/api/src/modules/workflow/state.ts
import { Annotation } from '@langchain/langgraph';
import { BaseMessage } from '@langchain/core/messages';

/**
 * 基础 Agent 状态 — 所有 Workflow 策略共享。
 * 使用 LangGraph 的 Annotation API（非 StateSchema，后者不存在）。
 *
 * 各策略可通过 workflows.config 传入自定义状态扩展，
 * 在构造 StateGraph 时通过 channels 参数合并。
 * 
  messages        — 消息列表（llm / 所有节点）
  kbId            — 知识库 ID（retriever）
  kbIds           — 多知识库（retriever）
  modelId         — 模型 ID（llm / reflection）
  sessionId       — 会话 ID（通用）
  promptTemplateId — 提示词模板（llm）
  toolIds         — 工具列表（tool）
  retrievedChunks — 检索结果（retriever）
  citations       — 引用信息（retriever）
  context         — 格式化上下文文本（llm）
  iteration       — 迭代次数（reflection）
  needsImprovement — 是否需要改进（reflection）
  judgeResult     — 评判结果（reflection）
  plan            — 子任务计划（planner）
  currentSubtask  — 当前子任务（solver）
  subtaskResults  — 子任务结果集（solver）
  agentOutputs    — 多 Agent 输出（aggregator）
  aggregatedResult — 合并结果（aggregator）
  toolResults     — 工具执行结果（tool）
  error           — 错误信息（所有节点）
 */

// 消息列表 reducer（追加模式）
const messagesReducer = (prev: BaseMessage[], next: BaseMessage[]) => [...prev, ...next];

export const AgentStateAnnotation = Annotation.Root({
  // 消息列表 (LangGraph 内置，追加模式)
  messages: Annotation<BaseMessage[]>({
    reducer: messagesReducer,
    default: () => [],
  }),

  // ── 执行上下文（运行时由 ExecutionService 注入）──
  kbId: Annotation<string | undefined>({ default: () => undefined }),
  kbIds: Annotation<string[]>({ default: () => [] }),
  modelId: Annotation<string | undefined>({ default: () => undefined }),
  sessionId: Annotation<string | undefined>({ default: () => undefined }),
  promptTemplateId: Annotation<string | undefined>({ default: () => undefined }),
  toolIds: Annotation<string[]>({ default: () => [] }),

  // ── 检索结果 ──
  retrievedChunks: Annotation<any[]>({ default: () => [] }),
  citations: Annotation<any[]>({ default: () => [] }),
  context: Annotation<string | undefined>({ default: () => undefined }),

  // ── Reflection 状态（ReflectionStrategy 使用）──
  iteration: Annotation<number>({ default: () => 0 }),
  needsImprovement: Annotation<boolean>({ default: () => false }),
  judgeResult: Annotation<string | undefined>({ default: () => undefined }),

  // ── ReWOO 规划/求解（Planner + Solver 使用）──
  plan: Annotation<any | undefined>({ default: () => undefined }),
  currentSubtask: Annotation<string | undefined>({ default: () => undefined }),
  subtaskResults: Annotation<any[]>({ default: () => [] }),

  // ── Multi-Agent 聚合（Aggregator 使用）──
  agentOutputs: Annotation<any[]>({ default: () => [] }),
  aggregatedResult: Annotation<any | undefined>({ default: () => undefined }),

  // ── 工具执行结果 ──
  toolResults: Annotation<any[]>({ default: () => [] }),

  // ── 错误（节点级兜底）──
  error: Annotation<string | undefined>({ default: () => undefined }),
});

export type AgentState = typeof AgentStateAnnotation.State;
```

### 2.3 LangGraph 概念映射

| LangGraph 概念 | 本项目对应 |
|---|---|
| `StateGraph` | 策略内部构建的图（每个策略一个） |
| `addNode(name, fn)` | 从 NodeRegistry 取得节点执行函数 |
| `addEdge(from, to)` | 策略代码中定义的固定边 |
| `addConditionalEdges(from, router)` | 条件路由（如 Judge → Retriever 或 END）|
| `CompiledStateGraph` | `.compile()` 后的可执行图 |
| `graph.stream(input)` | 流式执行，产出的每步事件映射到 node_steps |
| `RunnableConfig` | 运行时配置（recursionLimit, callbacks 等）|
| `interrupt()` + `MemorySaver` | V4.5 Human-in-the-loop 断点恢复（使用 LangGraph 原生机制，替代手动 node_steps 恢复） |

---

## 3. Layer 2: Node Registry

> **位置决策**: NodeRegistry 放在 `apps/api/src/modules/workflow/`，而非 `packages/ai-core`。
> 理由：`ai-core` 是纯协议层（零运行时依赖，zero framework deps），不应引入 NestJS DI 和 API 侧服务依赖。
> 节点需要注入 `RetrievalService`、`ModelCallerService` 等 API 侧服务，放在 api 侧更合理。

### 3.1 GraphNode 接口

```typescript
// apps/api/src/modules/workflow/node-registry.ts
import { RunnableConfig } from '@langchain/core/runnables';
import { AgentState } from './state';

/**
 * 节点步骤回调 — 由 ExecutionService 提供，避免 NodeRegistry 反向依赖 ExecutionService
 */
export type OnStepCallback = (event: NodeStepEvent) => void | Promise<void>;

/**
 * 节点执行上下文
 */
export interface NodeContext {
  state: AgentState;
  config: RunnableConfig;
  metadata: {
    nodeId: string;
    nodeType: WorkflowNodeType;
    workflowId: string;
    executionId: string;
  };
  /** 步骤回调：节点内部调用以通知 ExecutionService 写 node_steps */
  onStep: OnStepCallback;
}

/**
 * 节点步骤事件
 */
export interface NodeStepEvent {
  nodeId: string;
  nodeType: WorkflowNodeType;
  status: 'running' | 'completed' | 'failed' | 'skipped';
  input?: Record<string, any>;
  output?: Record<string, any>;
  durationMs?: number;
  errorMessage?: string;
  startedAt: string;
  completedAt?: string;
}

/**
 * 节点实现接口 — 所有节点类型都遵循此接口
 */
export interface GraphNode {
  readonly type: WorkflowNodeType;
  readonly label: string;

  /** 核心执行方法 */
  execute(ctx: NodeContext): Promise<Partial<AgentState>>;

  /** 校验节点配置（来自 DB config JSONB） */
  validateConfig?(config: Record<string, unknown>): boolean;
}
```

### 3.2 NodeRegistry 实现

```typescript
// apps/api/src/modules/workflow/node-registry.ts
import { Injectable } from '@nestjs/common';
import { RunnableConfig } from '@langchain/core/runnables';
import { AgentState } from './state';

type GraphNodeFactory = (config?: Record<string, any>) => GraphNode;
type LangGraphNodeFn = (state: AgentState, config?: RunnableConfig) => Promise<Partial<AgentState>>;

@Injectable()
export class NodeRegistry {
  private factories = new Map<string, GraphNodeFactory>();
  private instances = new Map<string, GraphNode>();

  /** 注册节点类型 */
  register(type: WorkflowNodeType, factory: GraphNodeFactory): void {
    if (this.factories.has(type))
      throw new Error(`Node type "${type}" already registered`);
    this.factories.set(type, factory);
  }

  /**
   * 获取适配为 LangGraph NodeFunction 的执行函数。
   * onStep 回调由 ExecutionService 在创建 ctx 时注入。
   */
  getNodeFn(
    type: WorkflowNodeType,
    config?: Record<string, any>,
    onStep?: OnStepCallback,
  ): LangGraphNodeFn {
    const node = this.resolve(type, config);

    return async (state: AgentState, runtimeConfig?: RunnableConfig) => {
      const ctx: NodeContext = {
        state,
        config: runtimeConfig ?? {},
        metadata: {
          nodeId: (runtimeConfig?.configurable as any)?.nodeId ?? type,
          nodeType: type,
          workflowId: (runtimeConfig?.configurable as any)?.workflowId ?? '',
          executionId: (runtimeConfig?.configurable as any)?.executionId ?? '',
        },
        onStep: onStep ?? (() => {}),
      };

      const startTime = Date.now();

      // 发出 running 事件
      await ctx.onStep({
        nodeId: ctx.metadata.nodeId,
        nodeType: type,
        status: 'running',
        startedAt: new Date(startTime).toISOString(),
      });

      try {
        const result = await node.execute(ctx);
        const durationMs = Date.now() - startTime;

        await ctx.onStep({
          nodeId: ctx.metadata.nodeId,
          nodeType: type,
          status: 'completed',
          input: { /* 由节点自行填充 */ },
          output: result,
          durationMs,
          startedAt: new Date(startTime).toISOString(),
          completedAt: new Date().toISOString(),
        });

        return result;
      } catch (err: any) {
        const durationMs = Date.now() - startTime;
        await ctx.onStep({
          nodeId: ctx.metadata.nodeId,
          nodeType: type,
          status: 'failed',
          errorMessage: err.message,
          durationMs,
          startedAt: new Date(startTime).toISOString(),
          completedAt: new Date().toISOString(),
        });
        return { error: `${type} node failed: ${err.message}` };
      }
    };
  }

  private resolve(type: WorkflowNodeType, config?: Record<string, any>): GraphNode {
    const factory = this.factories.get(type);
    if (!factory) throw new Error(`Unknown node type: ${type}`);
    const key = `${type}:${JSON.stringify(config ?? {})}`;
    if (!this.instances.has(key)) {
      this.instances.set(key, factory(config ?? {}));
    }
    return this.instances.get(key)!;
  }
}
```

### 3.3 内置节点类型一览

| 节点类型 | 类名 | 职责 | config 来源 |
|---------|------|------|-----------|
| `start` | StartNode | 初始化状态，无操作 | — |
| `end` | EndNode | 标记完成，输出聚合 | — |
| `retriever` | RetrieverNode | 调用 RetrievalService 检索知识库 | `kbId`, `topK`, `strategy` |
| `llm` | LlmNode | 调 ChatProvider / ModelCallerService | `modelId`, `temperature`, `maxTokens` |
| `tool` | ToolNode | 调 ToolExecutor 执行工具 | `toolId`, `timeout` |
| `condition` | ConditionNode | 条件判断，供条件边路由 | `expression`, `branches` |
| `reflection` | ReflectionNode | 对 LLM 输出做质量自查 | `maxIterations`, `judgePromptId` |
| `planner` | PlannerNode | 任务分解 (ReWOO) | `strategy` |
| `solver` | SolverNode | 子任务求解 (ReWOO) | 同 LLM |
| `aggregator` | AggregatorNode | 多路结果合并 (Multi-Agent) | `mergeStrategy` |
| `code` | CodeNode | 代码执行 (V3 沙箱) | `runtime`, `timeout` |

### 3.4 节点注册 — NestJS Module（简化版）

```typescript
// apps/api/src/modules/workflow/workflow.module.ts
@Module({
  imports: [
    PrismaModule,
    // 各节点需要的依赖模块
    RetrievalModule,
    ModelModule,
    // ToolModule (V3)
  ],
  providers: [
    NodeRegistry,
    WorkflowService,
    ExecutionService,
    StrategyFactory,

    // 内置节点直接注册为 provider
    StartNode,
    EndNode,
    ConditionNode,
    {
      provide: RetrieverNode,
      useFactory: (svc: RetrievalService) => new RetrieverNode(svc),
      inject: [RetrievalService],
    },
    {
      provide: LlmNode,
      useFactory: (svc: ModelCallerService) => new LlmNode(svc),
      inject: [ModelCallerService],
    },
    {
      provide: ReflectionNode,
      useFactory: (svc: ModelCallerService) => new ReflectionNode(svc),
      inject: [ModelCallerService],
    },
    // Planner / Solver / Aggregator / Tool / Code V3+ 时注册

    // 策略注册（自注册模式）
    RagStrategy,
    ReflectionStrategy,
    // ReWooStrategy, MultiAgentStrategy (V3+)
  ],
  controllers: [WorkflowController],
  exports: [ExecutionService, WorkflowService],
})
export class WorkflowModule implements OnModuleInit {
  constructor(
    private readonly registry: NodeRegistry,
    private readonly startNode: StartNode,
    private readonly endNode: EndNode,
    private readonly conditionNode: ConditionNode,
    private readonly retrieverNode: RetrieverNode,
    private readonly llmNode: LlmNode,
    private readonly reflectionNode: ReflectionNode,
    // 策略工厂
    private readonly strategyFactory: StrategyFactory,
    private readonly ragStrategy: RagStrategy,
    private readonly reflectionStrategy: ReflectionStrategy,
  ) {}

  onModuleInit() {
    // 注册节点
    this.registry.register('start',      () => this.startNode);
    this.registry.register('end',        () => this.endNode);
    this.registry.register('condition',  () => this.conditionNode);
    this.registry.register('retriever',  () => this.retrieverNode);
    this.registry.register('llm',        () => this.llmNode);
    this.registry.register('reflection', () => this.reflectionNode);
    // solver/code/planner/aggregator/tool V3 时注册

    // 注册策略（自注册模式，替代 switch-case）
    this.strategyFactory.register(this.ragStrategy);
    this.strategyFactory.register(this.reflectionStrategy);
  }
}
```

---

## 4. Layer 3: Strategy-Defined Graph

### 4.1 WorkflowStrategy 接口

```typescript
// apps/api/src/modules/workflow/strategies/workflow-strategy.interface.ts

/** 策略运行上下文 — 由 ExecutionService 装配 */
export interface WorkflowExecutionContext {
  workflow: {
    id: string;
    type: WorkflowType;
    config: Record<string, any>;           // workflows.config JSONB
  };
  executionId: string;
  input: {
    question: string;
    chatHistory?: ChatMessage[];
    kbIds?: string[];
    modelId?: string;
    tools?: Tool[];
  };
  /** 步骤回调 — 策略内部传给 NodeRegistry.getNodeFn() */
  onStep: OnStepCallback;
  /** 超时 AbortSignal — ExecutionService 注入 */
  signal?: AbortSignal;
  /** 运行配置 */
  timeoutMs?: number;
}

/** 运行时步骤事件 — 写入 node_steps 并转为 SSE（类型定义见 Layer 2 NodeStepEvent） */

export interface WorkflowStrategy {
  readonly type: WorkflowType;

  /**
   * 执行 Workflow，逐步产出事件。
   * ExecutionService 消费事件 → 内存累积 node_steps → 批量写 DB → SSE 推前端
   */
  run(ctx: WorkflowExecutionContext): AsyncGenerator<NodeStepEvent, void, void>;
}
```

### 4.2 StrategyFactory（注册表模式，替代 switch-case）

```typescript
// apps/api/src/modules/workflow/strategies/workflow-strategy.factory.ts
@Injectable()
export class StrategyFactory {
  private strategies = new Map<WorkflowType, WorkflowStrategy>();

  /** 注册策略 — 在 WorkflowModule.onModuleInit() 中调用 */
  register(strategy: WorkflowStrategy): void {
    if (this.strategies.has(strategy.type)) {
      throw new Error(`Strategy for type "${strategy.type}" already registered`);
    }
    this.strategies.set(strategy.type, strategy);
  }

  /** 按类型获取策略 */
  getStrategy(type: WorkflowType): WorkflowStrategy {
    const strategy = this.strategies.get(type);
    if (!strategy) {
      // rewoo / multi_agent / custom 未注册时统一抛 NotImplemented
      if (type === 'rewoo' || type === 'multi_agent' || type === 'custom') {
        throw new NotImplementedException(`${type} strategy is V3+`);
      }
      throw new BadRequestException(`Unknown workflow type: ${type}`);
    }
    return strategy;
  }
}
```

### 4.3 RagStrategy 实现（RAG 示例）

```typescript
// apps/api/src/modules/workflow/strategies/rag.strategy.ts
@Injectable()
export class RagStrategy implements WorkflowStrategy {
  readonly type = 'rag';

  constructor(
    private readonly registry: NodeRegistry,
  ) {}

  async *run(ctx: WorkflowExecutionContext): AsyncGenerator<NodeStepEvent> {
    const config = ctx.workflow.config;
    const { question, chatHistory, kbIds, modelId } = ctx.input;

    // 构建 LangGraph StateGraph（使用正确的 Annotation API）
    const graph = new StateGraph(AgentStateAnnotation)
      .addNode('retriever', this.registry.getNodeFn('retriever', {
        kbId: kbIds?.[0], topK: config.retriever?.topK ?? 20,
      }, ctx.onStep))
      .addNode('llm', this.registry.getNodeFn('llm', {
        modelId: modelId ?? config.llm?.modelId,
        temperature: config.llm?.temperature ?? 0.7,
      }, ctx.onStep))
      .addEdge(START, 'retriever')
      .addEdge('retriever', 'llm')
      .addEdge('llm', END)
      .compile();

    // 起始状态
    const input = {
      messages: [
        ...(chatHistory ?? []).map(m => m.role === 'user'
          ? new HumanMessage(m.content)
          : new AIMessage(m.content)),
        new HumanMessage(question),
      ],
      kbId: kbIds?.[0],
      modelId: modelId ?? config.llm?.modelId,
    };

    try {
      for await (const event of graph.stream(input, {
        configurable: { workflowId: ctx.workflow.id, executionId: ctx.executionId },
        signal: ctx.signal, // 支持 AbortController 超时/中断
      })) {
        for (const [nodeName, output] of Object.entries(event)) {
          // nodeName 是 addNode 时传入的字符串（如 'retriever'），
          // 与 DB workflow_nodes 的映射由前端展示时按 nodeType 匹配。
          yield {
            nodeId: nodeName as string,
            nodeType: this.resolveNodeType(nodeName as string),
            status: (output as any)?.error ? 'failed' : 'completed',
            input: { question },
            output: output as Record<string, any>,
            durationMs: 0, // 精确耗时由 NodeRegistry.onStep 回调记录
            startedAt: new Date().toISOString(),
            completedAt: new Date().toISOString(),
          };
        }
      }
    } catch (err: any) {
      // 确保 LangGraph 异常也被 yield 为 FAILED 事件
      yield {
        nodeId: 'graph',
        nodeType: 'end',
        status: 'failed',
        errorMessage: err.message,
        startedAt: new Date().toISOString(),
        completedAt: new Date().toISOString(),
      };
      throw err;
    }
  }

  private resolveNodeType(nodeName: string): WorkflowNodeType {
    const map: Record<string, WorkflowNodeType> = {
      'retriever': 'retriever',
      'llm': 'llm',
      'judge': 'reflection',
      'planner': 'planner',
      'solver': 'solver',
      'aggregator': 'aggregator',
    };
    return map[nodeName] ?? 'llm';
  }
}
```

### 4.4 ReflectionStrategy 实现（自查修正）

```typescript
// apps/api/src/modules/workflow/strategies/reflection.strategy.ts
@Injectable()
export class ReflectionStrategy implements WorkflowStrategy {
  readonly type = 'reflection';

  constructor(private readonly registry: NodeRegistry) {}

  async *run(ctx: WorkflowExecutionContext): AsyncGenerator<NodeStepEvent> {
    const maxIterations = ctx.workflow.config.maxIterations ?? 3;

    // 循环图: retriever → llm → judge(condition) → retriever 或 END
    const graph = new StateGraph(AgentStateAnnotation)
      .addNode('retriever', this.registry.getNodeFn('retriever', ctx.workflow.config.retriever, ctx.onStep))
      .addNode('llm', this.registry.getNodeFn('llm', ctx.workflow.config.llm, ctx.onStep))
      .addNode('judge', this.registry.getNodeFn('reflection', ctx.workflow.config.reflection, ctx.onStep))
      .addEdge(START, 'retriever')
      .addEdge('retriever', 'llm')
      .addEdge('llm', 'judge')
      .addConditionalEdges('judge', (state: AgentState) => {
        // 条件路由 — 代码表达, 不依赖 DB condition 字段
        const iteration = state.iteration ?? 0;
        if (state.needsImprovement && iteration < maxIterations) {
          return 'retriever';   // 重新检索+生成
        }
        return END;             // 质量达标, 结束
      })
      .compile();

    try {
      for await (const event of graph.stream(/* ... */, { signal: ctx.signal })) {
        // ... 同 RAG
      }
    } catch (err: any) {
      yield { /* ... FAILED event */ };
      throw err;
    }
  }
}
```

### 4.5 现有策略注册

| Strategy | `workflows.type` | 图结构 | 阶段 |
|---------|-----------------|--------|------|
| **RagStrategy** | `rag` | `retriever → llm` | V2 实现 |
| **ReflectionStrategy** | `reflection` | `retriever → llm → judge ↺ retriever \| END` | V2 实现 |
| **ReWooStrategy** | `rewoo` | `planner → worker(loop) → solver` | V3+ 打桩 |
| **MultiAgentStrategy** | `multi_agent` | `planner → retriever∥summarizer → aggregator` | V3+ 打桩 |
| **CustomStrategy** | `custom` | 由 DB nodes/edges 编译 | V3+ Designer |

---

## 5. Layer 4: Execution Runtime

### 5.1 执行流程

```
用户 POST /workflows/:id/run
         │
         ▼
 ExecutionService.execute(workflowId, input, userId)
         │
         ├── ① 查找 Workflow (含 config)
         ├── ② 并发限制：同一用户同时最多 N 个 RUNNING（可配置）
         ├── ③ 超时控制：AbortSignal.timeout(config.timeoutMs ?? 300_000)
         ├── ④ StrategyFactory.getStrategy(type)
         ├── ⑤ prisma.workflow_executions.create({ status: RUNNING, input, started_at, created_by })
         │
         ├── ⑥ strategy.run(ctx)  →  AsyncGenerator<NodeStepEvent>
         │     │
         │     ├── 构建 LangGraph StateGraph
         │     ├── graph.stream(input, { signal })
         │     ├── 每步事件 → 内存累积 nodeSteps[]
         │     ├── 每 N 步或 completed/failed → 批量写 node_steps
         │     └── COMPLETED / FAILED
         │
         ├── ⑦ prisma.workflow_executions.update({
         │      status: COMPLETED | FAILED,
         │      output, duration_ms, node_steps, completed_at
         │    })
         │
         ├── ⑧ 审计日志: action=WORKFLOW_EXECUTE
         └── ⑨ 返回 ExecutionResponse
```

### 5.2 ExecutionService 实现

```typescript
// apps/api/src/modules/workflow/execution.service.ts
@Injectable()
export class ExecutionService {
  private static readonly STEP_BATCH_SIZE = 10; // 每 10 步批量写一次 DB
  private static readonly MAX_CONCURRENT_PER_USER = 5;

  constructor(
    private readonly strategyFactory: StrategyFactory,
    private readonly prisma: PrismaService,
    private readonly eventEmitter: EventEmitter2,
    private readonly auditService: AuditService,
  ) {}

  /** 执行 Workflow — 主入口 */
  async execute(
    workflowId: string,
    input: ExecuteWorkflowDto,
    userId: string,
  ): Promise<ExecutionResponse> {
    const workflow = await this.prisma.workflow.findUniqueOrThrow({
      where: { id: workflowId },
    });

    // 并发限制：同一用户同时最多 N 个 RUNNING
    await this.checkConcurrencyLimit(userId);

    const strategy = this.strategyFactory.getStrategy(workflow.type as WorkflowType);

    const timeoutMs = (workflow.config as any)?.timeoutMs ?? 300_000; // 默认 5 分钟超时
    const abortController = new AbortController();

    // 创建执行记录
    const execution = await this.prisma.workflow_executions.create({
      data: {
        workflowId,
        input: input as any,
        status: 'RUNNING',
        startedAt: new Date(),
      },
    });

    // onStep 回调：内存累积 + 事件发射
    const nodeSteps: NodeStep[] = [];
    const onStep = async (event: NodeStepEvent) => {
      nodeSteps.push(event);
      this.eventEmitter.emit('workflow.step', { executionId: execution.id, event });

      // 批量写入：每 STEP_BATCH_SIZE 步写一次
      if (nodeSteps.length % ExecutionService.STEP_BATCH_SIZE === 0) {
        await this.persistNodeSteps(execution.id, nodeSteps);
      }
    };

    const ctx: WorkflowExecutionContext = {
      workflow: { id: workflow.id, type: workflow.type as WorkflowType, config: workflow.config as any },
      executionId: execution.id,
      input: { question: input.question, chatHistory: input.chatHistory, kbIds: input.kbIds },
      onStep,
      signal: abortController.signal,
      timeoutMs,
    };

    const startTime = Date.now();

    try {
      // 超时控制
      const timeoutId = setTimeout(() => abortController.abort(), timeoutMs);

      for await (const event of strategy.run(ctx)) {
        // 事件已在 onStep 中处理（内存累积 + 批量写 DB）
        // 此处仅做 SSE 推送（由 Controller 通过 Observable 处理）
      }
      clearTimeout(timeoutId);

      const duration = Date.now() - startTime;

      // 最终写入剩余 node_steps
      await this.persistNodeSteps(execution.id, nodeSteps);

      const result = await this.prisma.workflow_executions.update({
        where: { id: execution.id },
        data: {
          status: 'COMPLETED',
          output: { answer: this.extractAnswer(nodeSteps), citations: this.extractCitations(nodeSteps) },
          durationMs: duration,
          nodeSteps: nodeSteps as any,
          completedAt: new Date(),
        },
      });

      this.auditService.record({ action: 'WORKFLOW_EXECUTE', entityType: 'workflow', entityId: workflowId });

      return this.toResponse(result);
    } catch (err: any) {
      const duration = Date.now() - startTime;

      // 确保失败时也写入累积的 node_steps
      await this.persistNodeSteps(execution.id, nodeSteps);

      await this.prisma.workflow_executions.update({
        where: { id: execution.id },
        data: {
          status: err.name === 'AbortError' ? 'CANCELLED' : 'FAILED',
          errorMessage: err.name === 'AbortError' ? 'Execution timeout or cancelled' : err.message,
          durationMs: duration,
          nodeSteps: nodeSteps as any,
          completedAt: new Date(),
        },
      });
      throw err;
    }
  }

  /** 断点恢复（V3+ Human-in-the-loop 预留，使用 LangGraph 原生 checkpointer） */
  async resume(executionId: string): Promise<ExecutionResponse> {
    const execution = await this.prisma.workflow_executions.findUniqueOrThrow({
      where: { id: executionId },
    });
    if (execution.status !== 'PAUSED' && execution.status !== 'WAITING') {
      throw new BadRequestException(`Cannot resume execution in status: ${execution.status}`);
    }
    // V3: 使用 LangGraph 的 MemorySaver checkpointer 恢复
    // graph.stream(null, { configurable: { thread_id: executionId } })
    throw new NotImplementedException('Resume is V3+');
  }

  /** 持久化 node_steps */
  private async persistNodeSteps(executionId: string, steps: NodeStep[]): Promise<void> {
    await this.prisma.workflow_executions.update({
      where: { id: executionId },
      data: { nodeSteps: steps as any },
    });
  }

  /** 查询某个 Workflow 的所有执行记录 */
  async listByWorkflow(workflowId: string, query: PaginationDto): Promise<PaginatedResult<WorkflowExecution>> {
    const [items, total] = await Promise.all([
      this.prisma.workflow_executions.findMany({
        where: { workflowId },
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.workflow_executions.count({ where: { workflowId } }),
    ]);
    return { items, total, page: query.page, pageSize: query.pageSize };
  }

  /** 查询单条执行详情 */
  async getById(workflowId: string, execId: string): Promise<WorkflowExecution> {
    return this.prisma.workflow_executions.findFirstOrThrow({
      where: { id: execId, workflowId },
    });
  }

  /** 并发限制 */
  private async checkConcurrencyLimit(userId: string): Promise<void> {
    // 注意：workflow_executions 表目前没有 created_by 字段。
    // V2 阶段使用较宽松的全局并发限制（所有用户合计），
    // V3 增加 created_by FK 后改为 per-user 限制。
    const count = await this.prisma.workflow_executions.count({
      where: { status: 'RUNNING' },
    });
    if (count >= ExecutionService.MAX_CONCURRENT_PER_USER * 10) {
      throw new HttpException(
        `Too many concurrent executions (max ${ExecutionService.MAX_CONCURRENT_PER_USER * 10})`,
        429,
      );
    }
  }

  /**
   * 流式执行 — 供 SSE 端点调用
   * 返回 AsyncGenerator，由 Controller 消费并逐事件推送
   */
  async executeStream(
    workflowId: string,
    input: ExecuteWorkflowDto,
    userId: string,
    executionId: string,
  ): Promise<AsyncGenerator<NodeStepEvent, void, void>> {
    const workflow = await this.prisma.workflow.findUniqueOrThrow({
      where: { id: workflowId },
    });

    const strategy = this.strategyFactory.getStrategy(workflow.type as WorkflowType);
    const abortController = new AbortController();
    const timeoutMs = (workflow.config as any)?.timeoutMs ?? 300_000;

    // 创建执行记录
    await this.prisma.workflow_executions.create({
      data: { id: executionId, workflowId, input: input as any, status: 'RUNNING', startedAt: new Date() },
    });

    // onStep 回调
    const nodeSteps: NodeStep[] = [];
    const onStep = async (event: NodeStepEvent) => {
      nodeSteps.push(event);
      if (nodeSteps.length % ExecutionService.STEP_BATCH_SIZE === 0) {
        await this.persistNodeSteps(executionId, nodeSteps);
      }
    };

    const ctx: WorkflowExecutionContext = {
      workflow: { id: workflow.id, type: workflow.type as WorkflowType, config: workflow.config as any },
      executionId,
      input: { question: input.question, chatHistory: input.chatHistory, kbIds: input.kbIds },
      onStep,
      signal: abortController.signal,
      timeoutMs,
    };

    // 返回异步生成器，由 Controller 消费
    const self = this;
    const timeoutId = setTimeout(() => abortController.abort(), timeoutMs);
    const startTime = Date.now();

    return (async function* () {
      try {
        for await (const event of strategy.run(ctx)) {
          yield event;
        }
        clearTimeout(timeoutId);

        const duration = Date.now() - startTime;
        await self.persistNodeSteps(executionId, nodeSteps);
        await self.prisma.workflow_executions.update({
          where: { id: executionId },
          data: {
            status: 'COMPLETED',
            output: { answer: self.extractAnswer(nodeSteps), citations: self.extractCitations(nodeSteps) },
            durationMs: duration,
            nodeSteps: nodeSteps as any,
            completedAt: new Date(),
          },
        });
      } catch (err: any) {
        clearTimeout(timeoutId);
        const duration = Date.now() - startTime;
        await self.persistNodeSteps(executionId, nodeSteps);
        await self.prisma.workflow_executions.update({
          where: { id: executionId },
          data: {
            status: err.name === 'AbortError' ? 'CANCELLED' : 'FAILED',
            errorMessage: err.name === 'AbortError' ? 'Execution timeout or cancelled' : err.message,
            durationMs: duration,
            nodeSteps: nodeSteps as any,
            completedAt: new Date(),
          },
        });
        throw err;
      }
    })();
  }
}
```

### 5.3 Controller 端点

```typescript
// apps/api/src/modules/workflow/workflow.controller.ts
@Controller('workflows')
export class WorkflowController {
  constructor(
    private readonly workflowService: WorkflowService,
    private readonly executionService: ExecutionService,
  ) {}

  // CRUD ...
  @Post()
  async create(@Body() dto: CreateWorkflowDto, @CurrentUser() user: UserEntity) { /* ... */ }

  @Get()
  async findAll(@Query() query: PaginationDto) { /* ... */ }

  @Get(':id')
  async findOne(@Param('id', ParseUUIDPipe) id: string) { /* ... */ }

  @Patch(':id')
  async update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateWorkflowDto) { /* ... */ }

  @Delete(':id')
  async remove(@Param('id', ParseUUIDPipe) id: string) { /* ... */ }

  // 执行相关
  @Post(':id/run')
  async run(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ExecuteWorkflowDto,
    @CurrentUser() user: UserEntity,
  ) {
    return this.executionService.execute(id, dto, user.id);
  }

  @Get(':id/executions')
  async getExecutions(
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: PaginationDto,
  ) {
    return this.executionService.listByWorkflow(id, query);
  }

  @Get(':id/executions/:execId')
  async getExecution(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('execId', ParseUUIDPipe) execId: string,
  ) {
    return this.executionService.getById(id, execId);
  }

  @Post(':id/executions/:execId/resume')
  async resume(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('execId', ParseUUIDPipe) execId: string,
  ) {
    return this.executionService.resume(execId);
  }
}
```

### 5.4 SSE 流式执行

对于 AI Application 场景，执行结果需要 SSE 流式推送到 Chat 前端。

```typescript
// 手动管理 SSE 响应（使用 @Res() + res.write()），不使用 @Sse() 装饰器。
// @Sse() 适用于返回 Observable 的模式，与 @Res() 手动写入不兼容。
import { Response, Request } from 'express';

@Post(':id/stream')
async runStream(
  @Param('id', ParseUUIDPipe) id: string,
  @Body() dto: ExecuteWorkflowDto,
  @CurrentUser() user: UserEntity,
  @Req() req: Request,
  @Res() res: Response,
) {
  // 设置 SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();

  const executionId = uuidv4();

  // 监听客户端断开
  req.on('close', () => {
    res.end();
  });

  try {
    const stream = this.executionService.executeStream(id, dto, user.id, executionId);
    for await (const event of stream) {
      if (res.destroyed) break;
      res.write(`event: step\ndata: ${JSON.stringify(event)}\n\n`);
    }
    if (!res.destroyed) {
      res.write(`event: done\ndata: ${JSON.stringify({ executionId })}\n\n`);
    }
  } catch (err: any) {
    if (!res.destroyed) {
      res.write(`event: error\ndata: ${JSON.stringify({ message: err.message })}\n\n`);
    }
  } finally {
    if (!res.destroyed) res.end();
  }
}
```

> **注意**: 如果 SSE 在 Worker 进程中执行，`EventEmitter2` 是进程内的，无法通知 API 进程的 SSE 连接。
> V2 阶段在 API 进程内同步执行（简单），V3 阶段可迁至 Worker 异步执行时需要通过 Redis Pub/Sub 回传进度。

### 5.5 node_steps 数据结构

与 DATABASE.md 对齐，使用 camelCase（JSONB 内标准）：

```json
[
  {
    "nodeId": "retriever",
    "nodeType": "retriever",
    "status": "completed",
    "input": {"query": "请假流程", "kbIds": ["uuid-hr"]},
    "output": {"chunksCount": 20, "topScore": 0.92},
    "durationMs": 350,
    "startedAt": "2026-09-01T10:00:00Z",
    "completedAt": "2026-09-01T10:00:00.350Z"
  },
  {
    "nodeId": "llm",
    "nodeType": "llm",
    "status": "completed",
    "input": {"promptTokens": 1200},
    "output": {"completionTokens": 250, "answer": "..."},
    "durationMs": 1800,
    "startedAt": "2026-09-01T10:00:00.350Z",
    "completedAt": "2026-09-01T10:00:02.150Z"
  }
]
```

> 注意: `nodeId` 是 LangGraph 的节点名（`addNode` 时传入的字符串），不是 DB `workflow_nodes.id`。
> 前端展示时通过 `nodeType` 匹配到对应节点卡片。

---

## 6. Layer 5: DeepAgents Harness（复杂策略使用）

DeepAgents 是 **可选的 Harness 层**，只在需要**规划/子Agent/文件系统/记忆**等高级能力的策略中使用。

### 6.1 使用场景

| 策略 | 是否使用 DeepAgents | 理由 |
|------|--------------------|------|
| `rag` | ❌ 不使用 | 简单链式检索+LLM，LangGraph 原生足够 |
| `reflection` | ❌ 不使用 | 条件循环已在 LangGraph 内实现 |
| `rewoo` | ✅ 使用（优先） / ❌ Plan B 纯 LangGraph | DeepAgents 的 `createDeepAgent` + `subagents` middleware 提供 Planner/Worker/Solver 模式 |
| `multi_agent` | ✅ 使用（优先） / ❌ Plan B 纯 LangGraph | DeepAgents 的 `subagents`/`async_subagents` middleware 实现多 Agent 协作 |

### 6.2 可行性验证（P0 前置）

> **⚠️ 关键风险**: `deepagents` 包是 **Python 优先**的，JavaScript/TypeScript 版本能力可能不同。
> 在 Phase 2 实现 ReWOO 前，必须先验证 npm `deepagents` 的可用性：
>
> 1. 检查 npm 是否存在 `deepagents` 包
> 2. 验证其导出 API 是否包含 `createDeepAgent`、middleware 体系
> 3. 验证 `agent.getGraph()` 是否返回 `CompiledStateGraph`
>
> **如果不可用，走 Plan B：纯 LangGraph 实现。**

### 6.3 ReWooStrategy 使用 DeepAgents（Plan A）

```typescript
// apps/api/src/modules/workflow/strategies/rewoo.strategy.ts (V3+)
import { createDeepAgent } from 'deepagents';

@Injectable()
export class ReWooStrategy implements WorkflowStrategy {
  readonly type = 'rewoo';

  async *run(ctx: WorkflowExecutionContext): AsyncGenerator<NodeStepEvent> {
    const agent = createDeepAgent({
      model: ctx.input.modelId,
      tools: ctx.input.tools ?? [],
      middleware: ['planning', 'filesystem', 'subagents'],
      permissions: [{ type: 'read', path: '/data' }],
    });

    const graph = agent.getGraph(); // 返回 CompiledStateGraph
    for await (const event of graph.stream({ messages: [userMessage] }, { signal: ctx.signal })) {
      // 映射为 NodeStepEvent
    }
  }
}
```

### 6.4 Plan B: 纯 LangGraph 实现 ReWOO（DeepAgents 不可用时）

如果 JS 版 deepagents 不成熟，用纯 LangGraph 实现 Planner/Worker/Solver：

```typescript
// Plan B: ReWOO 的纯 LangGraph 实现
export class ReWooStrategy implements WorkflowStrategy {
  readonly type = 'rewoo';

  async *run(ctx: WorkflowExecutionContext): AsyncGenerator<NodeStepEvent> {
    const graph = new StateGraph(AgentStateAnnotation)
      .addNode('planner', this.registry.getNodeFn('planner', ctx.workflow.config.planner, ctx.onStep))
      .addNode('solver', this.registry.getNodeFn('solver', ctx.workflow.config.solver, ctx.onStep))
      .addEdge(START, 'planner')
      .addConditionalEdges('planner', (state) => {
        // 根据 planner 输出的子任务列表，用 LangGraph Send API 并行派发到 solver
        // 这需要 LangGraph 的 map-reduce 模式
        return 'solver';
      })
      .addEdge('solver', END)
      .compile();

    for await (const event of graph.stream(/* ... */, { signal: ctx.signal })) {
      // ...
    }
  }
}
```

---

## 7. 与现有 CRUD 的对接

### 7.1 WorkflowService 改造

现有 `WorkflowService` 返回占位字符串，需要接真实 Prisma 查询：

```typescript
// apps/api/src/modules/workflow/workflow.service.ts
@Injectable()
export class WorkflowService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateWorkflowDto, userId: string) {
    const workflow = await this.prisma.workflow.create({
      data: {
        name: dto.name,
        type: dto.type,
        description: dto.description,
        config: dto.config ?? {},
        createdBy: userId,
      },
    });

    // 如果前端传了 nodes/edges，同步写入（可选，为 V3 Designer 预留）
    if (dto.nodes?.length) {
      await this.syncGraphStructure(workflow.id, dto.nodes, dto.edges);
    }

    return workflow;
  }

  async findOne(id: string) {
    return this.prisma.workflow.findUniqueOrThrow({
      where: { id },
      include: {
        nodes: { orderBy: { positionY: 'asc' } },
        edges: true,
      },
    });
  }

  /** 同步图结构到 workflow_nodes/workflow_edges（V3 Designer 使用） */
  private async syncGraphStructure(
    workflowId: string,
    nodes: WorkflowNodeInput[],
    edges: WorkflowEdgeInput[],
  ): Promise<void> {
    // 注意: Prisma createMany 不返回插入的 ID。
    // 解决方案：使用客户端生成的 UUID，让前端在发送 edges 时已经带有 node ID。
    // 或者使用 raw SQL 的 INSERT ... RETURNING id。
    await this.prisma.$transaction(async (tx) => {
      await tx.workflowEdge.deleteMany({ where: { workflowId } });
      await tx.workflowNode.deleteMany({ where: { workflowId } });

      // 使用客户端 ID（前端已生成 UUID）
      await tx.workflowNode.createMany({
        data: nodes.map((n) => ({
          id: n.id, // 客户端生成的 UUID
          workflowId,
          type: n.type,
          label: n.label,
          positionX: n.positionX,
          positionY: n.positionY,
          config: n.config ?? {},
        })),
      });

      if (edges?.length) {
        await tx.workflowEdge.createMany({
          data: edges.map((e) => ({
            workflowId,
            sourceNodeId: e.sourceNodeId,
            targetNodeId: e.targetNodeId,
            sourceHandle: e.sourceHandle,
            targetHandle: e.targetHandle,
            label: e.label,
            condition: e.condition ?? undefined,
          })),
        });
      }
    });
  }
}
```

### 7.2 CreateWorkflowDto 改造

```typescript
// apps/api/src/modules/workflow/dto/create-workflow.dto.ts
export class WorkflowNodeInputDto {
  @IsUUID() id: string; // 客户端生成 UUID，解决 createMany 不返回 ID 的问题
  @IsIn(['start', 'end', 'retriever', 'llm', 'tool', 'condition', 'reflection', 'planner', 'solver', 'aggregator', 'code'])
  type: string;
  @IsString() label: string;
  @IsOptional() @IsNumber() positionX?: number;
  @IsOptional() @IsNumber() positionY?: number;
  @IsOptional() @IsObject() config?: Record<string, any>;
}

export class WorkflowEdgeInputDto {
  @IsUUID() sourceNodeId: string; // 引用客户端生成的 node ID
  @IsUUID() targetNodeId: string;
  @IsOptional() @IsString() sourceHandle?: string;
  @IsOptional() @IsString() targetHandle?: string;
  @IsOptional() @IsString() label?: string;
  @IsOptional() @IsObject() condition?: Record<string, any>;
}

export class CreateWorkflowDto {
  @IsString() @IsNotEmpty()
  name: string;

  @IsIn(['rag', 'reflection', 'rewoo', 'multi_agent', 'custom'])
  type: string;

  @IsOptional() @IsString()
  description?: string;

  @IsOptional() @IsObject()
  config?: Record<string, any>;

  // 图结构（V3 Designer 必填，V2 代码驱动可选）
  @IsOptional() @ValidateNested({ each: true })
  @Type(() => WorkflowNodeInputDto)
  nodes?: WorkflowNodeInputDto[];

  @IsOptional() @ValidateNested({ each: true })
  @Type(() => WorkflowEdgeInputDto)
  edges?: WorkflowEdgeInputDto[];
}
// 注意：ValidationPipe 需配置 { transform: true }，否则 @Type 装饰器不会将
// 纯 JSON 对象转换为 class 实例，导致 @ValidateNested 校验失效。
```

---

## 8. V3 Designer 兼容（CustomStrategy）

模式 B 的 CustomStrategy 是 V3 Workflow Designer 的运行时：

```typescript
// apps/api/src/modules/workflow/strategies/custom.strategy.ts (V3+)
@Injectable()
export class CustomStrategy implements WorkflowStrategy {
  readonly type = 'custom';

  constructor(
    private readonly registry: NodeRegistry,
    private readonly prisma: PrismaService, // 懒加载，V2 阶段不注册此策略
  ) {}

  async *run(ctx: WorkflowExecutionContext): AsyncGenerator<NodeStepEvent> {
    const [nodes, edges] = await Promise.all([
      this.prisma.workflowNode.findMany({ where: { workflowId: ctx.workflow.id } }),
      this.prisma.workflowEdge.findMany({ where: { workflowId: ctx.workflow.id } }),
    ]);

    // 从 DB nodes/edges 编译为 LangGraph StateGraph
    const graph = this.compileGraph(nodes, edges, ctx.onStep);

    for await (const step of graph.stream(ctx.input, { signal: ctx.signal })) {
      yield this.toEvent(step);
    }
  }

  /** 通用编译：DB nodes → LangGraph StateGraph */
  private compileGraph(
    nodes: WorkflowNode[],
    edges: WorkflowEdge[],
    onStep: OnStepCallback,
  ): CompiledStateGraph {
    const builder = new StateGraph(AgentStateAnnotation);

    // 添加节点
    // 可执行节点类型：排除 start/end
    const EXECUTABLE_NODE_TYPES = new Set<WorkflowNodeType>([
      'retriever', 'llm', 'condition', 'reflection',
      'tool', 'planner', 'worker', 'solver', 'code',
    ]);
    for (const node of nodes) {
      if (node.type === 'end') continue;
      if (node.type === 'start') {
        // start 节点作为 passthrough node 加入 StateGraph，使 START 可以连接到它
        builder.addNode(node.id, async (state) => state);
        continue;
      }
      if (!EXECUTABLE_NODE_TYPES.has(node.type as WorkflowNodeType)) {
        throw new Error(`Unknown executable node type: ${node.type}`);
      }
      const nodeFn = this.registry.getNodeFn(
        node.type as WorkflowNodeType,
        node.config as any,
        onStep,
      );
      builder.addNode(node.id, nodeFn);
    }

    // 添加边
    // 条件边设计：DB 中每条以 condition 为 true 时走的路由单独存一条 edge 记录。
    // 多条同 source 的条件边在 compile 时合并为一个 router 函数。
    const edgeGroups = this.groupEdgesBySource(edges);

    for (const [sourceId, sourceEdges] of edgeGroups) {
      const fixedEdges = sourceEdges.filter(e => !e.condition);
      const conditionalEdges = sourceEdges.filter(e => e.condition);

      for (const edge of fixedEdges) {
        builder.addEdge(edge.sourceNodeId, edge.targetNodeId);
      }

      if (conditionalEdges.length > 0) {
        builder.addConditionalEdges(sourceId, (state) => {
          for (const edge of conditionalEdges) {
            if (ConditionEvaluator.evaluate(edge.condition as any, state)) {
              return edge.targetNodeId;
            }
          }
          return END; // 无条件满足时默认结束
        });
      }
    }

    // 连接 start/end
    const startNode = nodes.find((n) => n.type === 'start');
    const endNode = nodes.find((n) => n.type === 'end');
    if (startNode) builder.addEdge(START, startNode.id);
    if (endNode) {
      // 所有无出边的节点 → end
      for (const node of nodes) {
        if (node.type !== 'end' && !edgeGroups.has(node.id)) {
          builder.addEdge(node.id, endNode.id);
        }
      }
    }

    return builder.compile();
  }

  private groupEdgesBySource(edges: WorkflowEdge[]): Map<string, WorkflowEdge[]> {
    const map = new Map<string, WorkflowEdge[]>();
    for (const e of edges) {
      const list = map.get(e.sourceNodeId) ?? [];
      list.push(e);
      map.set(e.sourceNodeId, list);
    }
    return map;
  }
}
```

### ConditionEvaluator 定义

```typescript
// apps/api/src/modules/workflow/strategies/condition-evaluator.ts (V3+)

/**
 * 条件表达式求值器 — 安全的 JSON-based DSL 求值。
 * 支持:
 *   { field: "stateKey", operator: "equals", value: "expected" }
 *   { and: [...conditions] }
 *   { or: [...conditions] }
 *   { not: condition }
 */
export class ConditionEvaluator {
  private static readonly OPERATORS: Record<string, (a: any, b: any) => boolean> = {
    equals: (a, b) => a === b,
    notEquals: (a, b) => a !== b,
    gt: (a, b) => a > b,
    gte: (a, b) => a >= b,
    lt: (a, b) => a < b,
    lte: (a, b) => a <= b,
    in: (a, b) => Array.isArray(b) && b.includes(a),
    contains: (a, b) => typeof a === 'string' && a.includes(b),
  };

  static evaluate(condition: any, state: any): boolean {
    if (condition.field !== undefined) {
      const actual = state[condition.field];
      const op = this.OPERATORS[condition.operator];
      if (!op) throw new Error(`Unknown operator: ${condition.operator}`);
      return op(actual, condition.value);
    }
    if (condition.and) return condition.and.every((c: any) => this.evaluate(c, state));
    if (condition.or) return condition.or.some((c: any) => this.evaluate(c, state));
    if (condition.not) return !this.evaluate(condition.not, state);
    // 未知条件格式：返回 false 作为安全默认（不触发路由分支）
    // 生产环境建议通过 logger.warn 记录，便于排查 DB 中 condition 配置错误
    return false;
  }
}
```

### condition 字段的 V3 使用

```
workflow_edges.condition JSONB 示例:

{"field": "judgeResult", "operator": "equals", "value": "needs_improvement"}
```

编译为 LangGraph 条件边：

```typescript
// 条件分支的每条边（source→target_true, source→target_false）各存一条记录
// edges 表中:
//   edge1: source=judge, target=retriever, condition={"field":"judgeResult","operator":"equals","value":"needs_improvement"}
//   edge2: source=judge, target=end,       condition={"field":"judgeResult","operator":"notEquals","value":"needs_improvement"}
```

---

## 9. 与现有模块的集成依赖

| 依赖 | 提供方 | 位置 | 用途 |
|------|-------|------|------|
| `NodeRegistry` | `apps/api` workflow 模块 | `apps/api` | 节点注册与发现 |
| `RetrievalService` | `apps/api` retrieval 模块 | `apps/api` | RetrieverNode |
| `ModelCallerService` | `apps/api` model 模块 | `apps/api` | LlmNode, ReflectionNode |
| `ToolExecutorService` | `apps/api` tool 模块 (V3) | `apps/api` | ToolNode |
| `ChatProvider` | `@nexus/ai-core` | `packages/ai-core` | LLM 流式/非流式调用（纯协议） |
| `AuditService` | `apps/api` audit-log 模块 | `apps/api` | 审计横切 |
| `SessionLockService` | `apps/api` common 模块 | `apps/api` | Chat 端并发控制 |
| `@langchain/langgraph` | npm | `apps/api` | StateGraph 构建与执行 |

---

## 10. 实现计划

### Phase 1: 基础设施

| Task | 内容 |
|------|------|
| 1.1 | 安装 `@langchain/langgraph` / `@langchain/core` 到 `apps/api/package.json` |
| 1.2 | 创建 `apps/api/src/modules/workflow/state.ts`：AgentStateAnnotation（LangGraph Annotation API）|
| 1.3 | 创建 `apps/api/src/modules/workflow/node-registry.ts`：GraphNode 接口、NodeRegistry、NodeContext、OnStepCallback |
| 1.4 | 实现 6 种核心内置节点（Start/End/Retriever/LLM/Condition/Reflection 先做，其余打桩） |
| 1.5 | WorkflowModule 内 onModuleInit 注册 NodeRegistry + 节点 |
| 1.6 | 单测：NodeRegistry 注册/发现、节点 execute 签名 |

### Phase 2: 策略层

| Task | 内容 |
|------|------|
| 2.1 | 补全 WorkflowStrategy 接口、StrategyFactory（注册表模式） |
| 2.2 | 实现 RagStrategy（retriever → llm → end） |
| 2.3 | 实现 ReflectionStrategy（retriever → llm → judge → retriever\|end） |
| 2.4 | ReWooStrategy / MultiAgentStrategy 抛 NotImplementedException（预留） |
| 2.5 | 验证 npm `deepagents` 可用性，决定 Plan A 或 Plan B |
| 2.6 | 单测：两种策略的图拓扑正确性、条件路由 |

### Phase 3: 执行层

| Task | 内容 |
|------|------|
| 3.1 | 实现 ExecutionService.execute() — 核心链路（含超时/并发限制/批量写入） |
| 3.2 | 实现 Controller 的 run/executions/listExecutions/resume 端点 |
| 3.3 | node_steps 批量持久化 + 审计日志 |
| 3.4 | 改造 WorkflowService CRUD 接真实 Prisma |
| 3.5 | 改造 CreateWorkflowDto 增加 nodes/edges 字段（客户端生成 UUID） |
| 3.6 | `workflow_executions` 增加 `created_by` 字段（Prisma schema + DB migration） |
| 3.7 | 集成测试：POST /workflows → POST /run → GET /executions |
| 3.8 | `chat_sessions.workflow_type` CHECK 约束新增 `'custom'`（Prisma schema + DB ALTER TYPE） |

### Phase 4: 前端接线 + SSE

| Task | 内容 |
|------|------|
| 4.1 | 前端 `POST /:id/run` 接真实数据 |
| 4.2 | 前端 `GET /:id/executions` 接真实数据 |
| 4.3 | SSE 流式执行端点（`/workflows/:id/stream`，POST + @Res() 手动写入） |
| 4.4 | WorkflowDetail 页显示真实执行历史 |

### Phase 5: V3 Designer 预留

| Task | 内容 |
|------|------|
| 5.1 | CustomStrategy + compileGraph 通用编译器 |
| 5.2 | ConditionEvaluator 表达式解析引擎 |
| 5.3 | DB nodes/edges → LangGraph StateGraph 的双向映射 |
| 5.4 | Vue Flow Designer 拖拽 → 保存 → run 闭环 |
| 5.5 | LangGraph `interrupt()` + `MemorySaver` checkpointer 接入 Human-in-the-loop |

---

## 11. 附录: 与 DATABASE.md 的一致性检查

| DB 字段 | 设计中使用方式 | 一致性 |
|---------|--------------|--------|
| `workflows.type` | Mode A: `'rag'`/`'reflection'`/...; Mode B: `'custom'` | ✅ 新增 `'custom'` 枚举 |
| `workflows.config` | 策略参数注入（Mode A+B 都使用） | ✅ 一致 |
| `workflow_nodes` | Mode A: 可选同步（前端展示）；Mode B: 必须。客户端生成 UUID | ✅ 表结构不变 |
| `workflow_edges` | Mode A: 可选同步，condition 留空；Mode B: 条件边每条存一条记录 | ✅ 表结构不变 |
| `workflow_edges.condition` | Mode A: 代码表达（不存 DB）；Mode B: JSONB 表达式，由 ConditionEvaluator 求值 | ✅ 按需使用 |
| `workflow_executions` | 两模式完全一致：status、duration_ms、node_steps JSONB | ✅ 完全一致 |
| `workflow_executions.created_by` | V2 使用全局并发限制，V3 增加 created_by FK 后改为 per-user | ⏸️ V3 时 ALTER TABLE 新增 |
| `node_steps` 格式 | camelCase: nodeId, nodeType, status, input, output, durationMs, startedAt, completedAt | ✅ 统一 camelCase |
| `execution_status` 枚举 | RUNNING / COMPLETED / FAILED / CANCELLED / PAUSED / WAITING | ✅ 一致，PAUSED/WAITING 用于 V3+ checkpointer |
| `chat_sessions.workflow_type` | 后端新建会话时校验 + Prisma schema CHECK 约束需新增 `'custom'` | ⚠️ 需 ALTER TYPE 及 Prisma schema 同步 |

---

## 12. 架构全景图

```
┌─────────────────────────────────────────────────────────────────────┐
│                       前端 (Vue 3 + Element Plus)                     │
│                                                                      │
│  WorkflowList → WorkflowDetail → ExecutionDetail → WorkflowDesigner  │
│                              │  POST /run · GET /executions          │
└──────────────────────────────┼──────────────────────────────────────┘
                               │ HTTP / SSE
┌──────────────────────────────┼──────────────────────────────────────┐
│                     后端 (NestJS + TypeScript)                       │
│                                                                      │
│  ┌──────────────── Workflow Controller ──────────────────────────┐  │
│  │  POST /workflows    GET /:id/run    GET /:id/executions       │  │
│  └───────────────────────────────────────────────────────────────┘  │
│                              │                                       │
│  ┌─────────── WorkflowModule (apps/api) ─────────────────────────┐  │
│  │                                                               │   │
│  │  ┌───── WorkflowService ─────┐  ┌───── ExecutionService ──┐  │   │
│  │  │ CRUD + graph sync        │  │ execute / resume / list  │  │   │
│  │  │ (客户端生成 UUID)          │  │ 超时控制 / 并发限制        │  │   │
│  │  └──────────────────────────┘  │ 批量写 node_steps         │  │   │
│  │                                └──────────┬───────────────┘  │   │
│  │                                           │                    │   │
│  │  ┌───── StrategyFactory ──────────────────┼─────────────┐    │   │
│  │  │  注册表模式（自注册，非 switch-case）     │             │    │   │
│  │  │  Rag │ Reflection │ ReWOO │ MultiAgent │ Custom     │    │   │
│  │  └────────────────────────────────────────┼─────────────┘    │   │
│  │                                           │                    │   │
│  │  ┌───── NodeRegistry ─────────────────────┴─────────────┐    │   │
│  │  │  retriever │ llm │ tool │ reflection │ planner │ ...  │    │   │
│  │  │  ┌── onStep 回调 → 内存累积 → 批量写 DB ───────┐     │    │   │
│  │  └─────────────────────────────────────────────────────┘    │   │
│  └───────────────────────────────────────────────────────────────┘  │
│                              │                                       │
│  ┌────── @langchain/langgraph ─────────────────────────────────┐   │
│  │  StateGraph / Annotation / addNode / addEdge / stream       │   │
│  │  addConditionalEdges / interrupt / MemorySaver              │   │
│  └──────────────────────────────────────────────────────────────┘   │
│                              │                                       │
│  ┌────── @nexus/ai-core (纯协议层) ────────────────────────────┐   │
│  │  ChatProvider / ChatRequest / ChatChunk                      │   │
│  │  EmbeddingProvider / EmbeddingService                        │   │
│  │  (零运行时依赖，不使用 LangGraph)                               │   │
│  └──────────────────────────────────────────────────────────────┘   │
│                              │                                       │
│  ┌──── deepagents (可选，V3+ 验证可行性) ─────────────────────────┐  │
│  │  createDeepAgent          │  middleware: planning/subagents   │   │
│  │  Plan B: 纯 LangGraph 实现 Planner/Worker/Solver              │   │
│  └──────────────────────────────────────────────────────────────┘   │
│                                                                      │
│  ┌────────────── 依赖模块 ──────────────────────────────────┐       │
│  │  RetrievalService │ ModelCallerService │ ToolExecutor    │       │
│  │  AuditService     │ SessionLockService  │ ChatProvider   │       │
│  └──────────────────────────────────────────────────────────┘       │
└─────────────────────────────────────────────────────────────────────┘
                                                         │
┌─────────────────────────────────────────────────────────────────────┐
│  Prisma (PostgreSQL + pgvector)                                      │
│  workflows · workflow_nodes · workflow_edges · workflow_executions   │
│  workflow_executions.created_by (★ 新增)                             │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 13. 设计决策记录（ADR）

| # | 决策 | 理由 | 替代方案 |
|---|------|------|---------|
| 1 | **NodeRegistry 放在 `apps/api`** | `ai-core` 是纯协议层，不应引入 NestJS DI 和 API 侧服务依赖 | 曾考虑放 `packages/ai-core`，但会导致反向依赖 |
| 2 | **LangGraph 依赖安装在 `apps/api`** | 同上，保持 `ai-core` 零运行时依赖 | 曾考虑放 `packages/ai-core` |
| 3 | **onStep 回调模式（非 EventEmitter）** | 避免 NodeRegistry 反向依赖 ExecutionService；更清晰的依赖方向 | 曾考虑 EventEmitter2，但跨层耦合 |
| 4 | **StrategyFactory 注册表模式** | 新增策略无需改 Factory 代码（OCP 原则） | 曾考虑 switch-case，但每次新增策略都要改 |
| 5 | **node_steps 批量写入** | 避免每步一次 DB UPDATE 的性能问题 | 曾考虑每步实时写入，但 50+ 节点场景性能差 |
| 6 | **客户端生成 UUID** | 解决 Prisma `createMany` 不返回 ID 的问题 | 曾考虑 raw SQL 或循环 create |
| 7 | **V2 在 API 进程内同步执行** | 简单，SSE 推送无跨进程问题 | V3 可迁至 Worker 异步执行（需 Redis Pub/Sub） |
| 8 | **LangGraph checkpointer 做断点恢复** | 使用框架原生能力，不重复造轮子 | 曾考虑手动读 node_steps 恢复，但 checkpointer 更可靠 |
| 9 | **AgentStateAnnotation 使用 Annotation API** | `StateSchema` 类在 LangGraph.js 中不存在 | 无 |
| 10 | **Plan B 纯 LangGraph 实现 ReWOO** | DeepAgents JS 版可能不可用 | 优先使用 DeepAgents |