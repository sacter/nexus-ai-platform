# NexusAI Workflow Engine 设计

> LangChain + LangGraph + DeepAgents 三框架集成设计
> 覆盖 workflow_nodes / workflow_edges / workflow_executions 完整链路

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
│  Layer 5: DeepAgents Harness  (规划/子Agent/记忆/技能 — 仅复杂策略)     │
│     createDeepAgent({ model, tools, middleware: [planning, ...] })    │
├──────────────────────────────────────────────────────────────────────┤
│  Layer 4: Execution Runtime  (生命周期/持久化/流式/中止/审计)           │
│     WorkflowExecutionService — 创建执行记录 → LangGraph stream →      │
│     写 node_steps → COMPLETED/FAILED                                  │
├──────────────────────────────────────────────────────────────────────┤
│  Layer 3: Strategy-Defined Graph  (拓扑定义 — 代码驱动)                │
│     RagStrategy / ReflectionStrategy / ReWooStrategy / MultiAgent    │
│     CustomGraphStrategy (V3 Designer)                               │
│     每个策略 = 一个 LangGraph StateGraph + 参数注入                    │
├──────────────────────────────────────────────────────────────────────┤
│  Layer 2: Node Registry  (节点实现 — 注册表管理)                       │
│     GraphNode 接口 + 11 种内置节点 + 注册/发现/组合                    │
│     横切：日志/审计/Token 计量                                       │
├──────────────────────────────────────────────────────────────────────┤
│  Layer 1: LangGraph Runtime  (底层图执行引擎)                          │
│     @langchain/langgraph: StateGraph / CompiledStateGraph /          │
│     addNode / addEdge / addConditionalEdges / stream                  │
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
                         │   StrategyFactory  │
                         │  按 type 分派       │
                         └────────┬──────────┘
                                  │
              ┌───────────────────┼───────────────────┐
              │                   │                   │
     ┌────────┴────────┐  ┌──────┴──────┐  ┌────────┴────────┐
     │ type='rag'      │  │ type='...'  │  │ type='custom'   │
     │ → RagStrategy   │  │ → 其他策略   │  │ → CustomStrategy│
     │ 代码定义拓扑     │  │  代码定义    │  │  DB 编译拓扑     │
     └────────┬────────┘  └──────┬──────┘  └────────┬────────┘
              │                   │                   │
              └───────────────────┼───────────────────┘
                                  │
                         ┌────────┴──────────┐
                         │  ExecutionService  │
                         │  ① 创建 execution  │
                         │  ② 调 strategy.run │
                         │  ③ LangGraph stream│
                         │  ④ 写 node_steps   │
                         │  ⑤ COMPLETED/FAILED│
                         └───────────────────┘
```

---

## 2. Layer 1: LangGraph Runtime

### 2.1 安装依赖

```json
// packages/ai-core/package.json
{
  "dependencies": {
    "@langchain/langgraph": "^1.2.0",
    "@langchain/core": "^0.3.0",
    "@langchain/langchain": "^0.3.0"
  }
}
```

### 2.2 AgentState 定义

```typescript
// packages/ai-core/src/workflow/state.ts
import { StateSchema, MessagesValue } from '@langchain/langgraph';
import { z } from 'zod';

/**
 * 基础 Agent 状态 — 所有 Workflow 策略共享。
 * 各策略可通过 workflows.config 传入自定义状态扩展。
 */
export const AgentStateSchema = new StateSchema({
  // 消息列表 (LangGraph 内置 reducer: 追加模式)
  messages: MessagesValue,

  // 当前节点追踪 (用于 node_steps)
  currentNodeId: z.string().optional(),
  currentNodeType: z.string().optional(),

  // 执行上下文 (运行时由 ExecutionService 注入)
  kbId: z.string().optional(),
  modelId: z.string().optional(),
  sessionId: z.string().optional(),
  promptTemplateId: z.string().optional(),

  // 检索结果
  retrievedChunks: z.array(z.any()).optional(),
  citations: z.array(z.any()).optional(),

  // 错误 (节点级兜底)
  error: z.string().optional(),
});
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
| `BaseCheckpointer` | V4.5 用于 Human-in-the-loop 断点恢复 |

---

## 3. Layer 2: Node Registry

### 3.1 GraphNode 接口

```typescript
// packages/ai-core/src/workflow/node-registry.ts

/**
 * 节点执行上下文
 */
export interface NodeContext {
  state: typeof AgentStateSchema;
  config: RunnableConfig;
  metadata: {
    nodeId: string;
    nodeType: WorkflowNodeType;
    workflowId: string;
    executionId: string;
  };
}

/**
 * 节点实现接口 — 所有节点类型都遵循此接口
 */
export interface GraphNode {
  readonly type: WorkflowNodeType;
  readonly label: string;

  /** 核心执行方法 */
  execute(ctx: NodeContext): Promise<Partial<typeof AgentStateSchema>>;

  /** 校验节点配置（来自 DB config JSONB） */
  validateConfig?(config: Record<string, unknown>): boolean;
}
```

### 3.2 NodeRegistry 实现

```typescript
// packages/ai-core/src/workflow/node-registry.ts
import { Injectable } from '@nestjs/common';

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

  /** 获取适配为 LangGraph NodeFunction 的执行函数 */
  getNodeFn(type: WorkflowNodeType, config?: Record<string, any>): LangGraphNodeFn {
    const node = this.resolve(type, config);

    return async (state: typeof AgentStateSchema, runtimeConfig: RunnableConfig) => {
      const ctx: NodeContext = {
        state,
        config: runtimeConfig,
        metadata: {
          nodeId: runtimeConfig.configurable?.nodeId ?? type,
          nodeType: type,
          workflowId: runtimeConfig.configurable?.workflowId ?? '',
          executionId: runtimeConfig.configurable?.executionId ?? '',
        },
      };

      const start = Date.now();
      try {
        const result = await node.execute(ctx);
        const duration = Date.now() - start;
        this.emitNodeStep(ctx, result, duration);
        return result;
      } catch (err) {
        return { error: formatNodeError(err, type) };
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

  /** 节点步骤事件 — ExecutionService 消费 */
  private emitNodeStep(ctx: NodeContext, result: any, durationMs: number): void {
    // 通过 EventEmitter 通知 ExecutionService 写 node_steps
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

### 3.4 节点注册 — NestJS Module

```typescript
// apps/api/src/modules/workflow/workflow.module.ts
@Module({
  providers: [
    NodeRegistry,
    // 内置节点实例提供
    { provide: 'RETRIEVER_NODE', useFactory: (svc) => new RetrieverNode(svc), inject: [RetrievalService] },
    { provide: 'LLM_NODE', useFactory: (svc) => new LlmNode(svc), inject: [ModelCallerService] },
    { provide: 'TOOL_NODE', useFactory: (svc) => new ToolNode(svc), inject: [ToolExecutorService] },
    { provide: 'REFLECTION_NODE', useFactory: (svc) => new ReflectionNode(svc), inject: [ModelCallerService] },
    { provide: 'PLANNER_NODE', useFactory: (svc) => new PlannerNode(svc), inject: [ModelCallerService] },
    { provide: 'AGGREGATOR_NODE', useFactory: (svc) => new AggregatorNode(svc), inject: [ModelCallerService] },
    // 注册到 NodeRegistry
    {
      provide: 'NODE_REGISTRATION',
      useFactory: (register: NodeRegistry, ...nodes: GraphNodeFactory[]) => {
        register.register('retriever',   nodes[0]);
        register.register('llm',         nodes[1]);
        register.register('tool',        nodes[2]);
        register.register('reflection',  nodes[3]);
        register.register('planner',     nodes[4]);
        register.register('aggregator',  nodes[5]);
        // start/end/condition 作为内置轻量节点，不需要外部注入
        register.register('start',     () => new StartNode());
        register.register('end',       () => new EndNode());
        register.register('condition', () => new ConditionNode());
        // solver/code V3 时注册
        return register;
      },
      inject: [NodeRegistry, 'RETRIEVER_NODE', 'LLM_NODE', 'TOOL_NODE',
               'REFLECTION_NODE', 'PLANNER_NODE', 'AGGREGATOR_NODE'],
    },
  ],
})
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
}

/** 运行时步骤事件 — 写入 node_steps 并转为 SSE */
export interface WorkflowStepEvent {
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

export interface WorkflowStrategy {
  readonly type: WorkflowType;

  /**
   * 执行 Workflow，逐步产出事件。
   * ExecutionService 消费事件 → 写 node_steps → SSE 推前端
   */
  run(ctx: WorkflowExecutionContext): AsyncGenerator<WorkflowStepEvent, void, void>;
}
```

### 4.2 RagStrategy 实现（RAG 示例）

```typescript
// apps/api/src/modules/workflow/strategies/rag.strategy.ts
@Injectable()
export class RagStrategy implements WorkflowStrategy {
  readonly type = 'rag';

  constructor(
    private readonly registry: NodeRegistry,
    private readonly retrievalService: RetrievalService,
    private readonly modelCallerService: ModelCallerService,
  ) {}

  async *run(ctx: WorkflowExecutionContext): AsyncGenerator<WorkflowStepEvent> {
    const config = ctx.workflow.config;
    const { question, chatHistory, kbIds, modelId } = ctx.input;

    // 构建 LangGraph StateGraph
    const graph = new StateGraph(AgentStateSchema)
      .addNode('retriever', this.registry.getNodeFn('retriever', {
        kbId: kbIds?.[0], topK: config.retriever?.topK ?? 20,
      }))
      .addNode('llm', this.registry.getNodeFn('llm', {
        modelId: modelId ?? config.llm?.modelId,
        temperature: config.llm?.temperature ?? 0.7,
      }))
      .addEdge(START, 'retriever')
      .addEdge('retriever', 'llm')
      .addEdge('llm', END)
      .compile();

    // 流式执行，映射为 WorkflowStepEvent
    const input = {
      messages: [
        ...(chatHistory ?? []),
        { role: 'user', content: question },
      ],
      kbId: kbIds?.[0],
      modelId: modelId ?? config.llm?.modelId,
    };

    for await (const event of graph.stream(input, {
      configurable: { workflowId: ctx.workflow.id, executionId: ctx.executionId },
    })) {
      for (const [nodeId, output] of Object.entries(event)) {
        yield {
          nodeId,
          nodeType: this.resolveNodeType(nodeId),
          status: output.error ? 'failed' : 'completed',
          input: { question },
          output,
          durationMs: 0, // LangGraph 不直接暴露 node 耗时，通过 EventEmitter 收集
          startedAt: new Date().toISOString(),
          completedAt: new Date().toISOString(),
        };
      }
    }
  }
}
```

### 4.3 ReflectionStrategy 实现（自查修正）

```typescript
// apps/api/src/modules/workflow/strategies/reflection.strategy.ts
@Injectable()
export class ReflectionStrategy implements WorkflowStrategy {
  readonly type = 'reflection';

  constructor(private readonly registry: NodeRegistry) {}

  async *run(ctx: WorkflowExecutionContext): AsyncGenerator<WorkflowStepEvent> {
    const maxIterations = ctx.workflow.config.maxIterations ?? 3;

    // 循环图: retriever → llm → judge(condition) → retriever 或 END
    const graph = new StateGraph(AgentStateSchema)
      .addNode('retriever', this.registry.getNodeFn('retriever', ctx.workflow.config.retriever))
      .addNode('llm', this.registry.getNodeFn('llm', ctx.workflow.config.llm))
      .addNode('judge', this.registry.getNodeFn('reflection', ctx.workflow.config.reflection))
      .addEdge(START, 'retriever')
      .addEdge('retriever', 'llm')
      .addEdge('llm', 'judge')
      .addConditionalEdges('judge', (state) => {
        // 条件路由 — 代码表达, 不依赖 DB condition 字段
        const iteration = state.iteration ?? 0;
        if (state.needsImprovement && iteration < maxIterations) {
          return 'retriever';   // 重新检索+生成
        }
        return END;             // 质量达标, 结束
      })
      .compile();

    // ... 执行同 RAG
  }
}
```

### 4.4 StrategyFactory

```typescript
// apps/api/src/modules/workflow/strategies/workflow-strategy.factory.ts
@Injectable()
export class StrategyFactory {
  constructor(
    private readonly rag: RagStrategy,
    private readonly reflection: ReflectionStrategy,
    // rewoo / multi_agent V3+ 时注册
    // private readonly rewoo: ReWooStrategy,
    // private readonly multiAgent: MultiAgentStrategy,
  ) {}

  getStrategy(type: WorkflowType): WorkflowStrategy {
    switch (type) {
      case 'rag':         return this.rag;
      case 'reflection':  return this.reflection;
      case 'rewoo':       throw new NotImplementedException('ReWOO strategy is V3+');
      case 'multi_agent': throw new NotImplementedException('Multi-Agent strategy is V3+');
      case 'custom':      throw new NotImplementedException('Custom strategy requires V3 Designer');
      default:            throw new BadRequestException(`Unknown workflow type: ${type}`);
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
 ExecutionService.execute(workflowId, input)
         │
         ├── ① 查找 Workflow (含 config)
         ├── ② StrategyFactory.getStrategy(type)
         ├── ③ prisma.workflow_executions.create({ status: RUNNING, input, started_at })
         │
         ├── ④ strategy.run(ctx)  →  AsyncGenerator<WorkflowStepEvent>
         │     │
         │     ├── 构建 LangGraph StateGraph
         │     ├── graph.stream(input)
         │     ├── 每步产出 → EventEmitter → 写 node_steps
         │     └── COMPLETED / FAILED
         │
         ├── ⑤ prisma.workflow_executions.update({
         │      status: COMPLETED | FAILED,
         │      output, duration_ms, node_steps, completed_at
         │    })
         │
         ├── ⑥ 审计日志: action=WORKFLOW_EXECUTE
         └── ⑦ 返回 ExecutionResponse
```

### 5.2 ExecutionService 实现

```typescript
// apps/api/src/modules/workflow/execution.service.ts
@Injectable()
export class ExecutionService {
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

    const strategy = this.strategyFactory.getStrategy(workflow.type as WorkflowType);

    // 创建执行记录
    const execution = await this.prisma.workflow_executions.create({
      data: {
        workflowId,
        input: input as any,
        status: 'RUNNING',
        startedAt: new Date(),
      },
    });

    const ctx: WorkflowExecutionContext = {
      workflow: { id: workflow.id, type: workflow.type as WorkflowType, config: workflow.config as any },
      executionId: execution.id,
      input: { question: input.question, chatHistory: input.chatHistory, kbIds: input.kbIds },
    };

    const nodeSteps: NodeStep[] = [];
    const startTime = Date.now();

    try {
      for await (const event of strategy.run(ctx)) {
        nodeSteps.push(event);

        // 每步持久化（也可批量，但 LangGraph 的节点数通常 < 50）
        await this.prisma.workflow_executions.update({
          where: { id: execution.id },
          data: { nodeSteps: nodeSteps as any },
        });

        // 通知监听者（如 SSE）
        this.eventEmitter.emit('workflow.step', { executionId: execution.id, event });
      }

      const duration = Date.now() - startTime;
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
    } catch (err) {
      const duration = Date.now() - startTime;
      await this.prisma.workflow_executions.update({
        where: { id: execution.id },
        data: {
          status: 'FAILED',
          errorMessage: err.message,
          durationMs: duration,
          nodeSteps: nodeSteps as any,
          completedAt: new Date(),
        },
      });
      throw err;
    }
  }

  /** 断点恢复（Human-in-the-loop 预留） */
  async resume(executionId: string): Promise<ExecutionResponse> {
    const execution = await this.prisma.workflow_executions.findUniqueOrThrow({
      where: { id: executionId },
    });
    if (execution.status !== 'PAUSED' && execution.status !== 'WAITING') {
      throw new BadRequestException(`Cannot resume execution in status: ${execution.status}`);
    }
    // 读 nodeSteps 最后完成节点，从 WAITING 节点继续
    // ...
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
  async create(@Body() dto: CreateWorkflowDto) { /* ... */ }

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
// 可选: SSE 流式执行端点
@Post(':id/stream')
@Sse()
async runStream(
  @Param('id', ParseUUIDPipe) id: string,
  @Body() dto: ExecuteWorkflowDto,
  @CurrentUser() user: UserEntity,
): Promise<Observable<MessageEvent>> {
  return new Observable((subscriber) => {
    const executionId = uuidv4();

    this.executionService.executeStream(id, dto, user.id, executionId)
      .then(async (stream) => {
        for await (const event of stream) {
          subscriber.next({ type: 'step', data: event });
        }
        subscriber.next({ type: 'done', data: { executionId } });
        subscriber.complete();
      })
      .catch((err) => {
        subscriber.next({ type: 'error', data: { message: err.message } });
        subscriber.complete();
      });
  });
}
```

### 5.5 node_steps 数据结构

与 DATABASE.md 对齐:

```json
[
  {
    "nodeId": "retriever-1",
    "nodeType": "retriever",
    "status": "completed",
    "input": {"query": "请假流程", "kbIds": ["uuid-hr"]},
    "output": {"chunksCount": 20, "topScore": 0.92},
    "durationMs": 350,
    "startedAt": "2026-09-01T10:00:00Z",
    "completedAt": "2026-09-01T10:00:00.350Z"
  },
  {
    "nodeId": "llm-1",
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

---

## 6. Layer 5: DeepAgents Harness（复杂策略使用）

DeepAgents 是 **可选的 Harness 层**，只在需要**规划/子Agent/文件系统/记忆**等高级能力的策略中使用。

### 6.1 使用场景

| 策略 | 是否使用 DeepAgents | 理由 |
|------|--------------------|------|
| `rag` | ❌ 不使用 | 简单链式检索+LLM，LangGraph 原生足够 |
| `reflection` | ❌ 不使用 | 条件循环已在 LangGraph 内实现 |
| `rewoo` | ✅ 使用 | DeepAgents 的 `createDeepAgent` + `subagents` middleware 提供 Planner/Worker/Solver 模式 |
| `multi_agent` | ✅ 使用 | DeepAgents 的 `subagents`/`async_subagents` middleware 实现多 Agent 协作 |

### 6.2 ReWooStrategy 使用 DeepAgents

```typescript
// apps/api/src/modules/workflow/strategies/rewoo.strategy.ts (V3+)
import { createDeepAgent } from 'deepagents';

@Injectable()
export class ReWooStrategy implements WorkflowStrategy {
  readonly type = 'rewoo';

  async *run(ctx: WorkflowExecutionContext): AsyncGenerator<WorkflowStepEvent> {
    // 使用 DeepAgents 构建 ReWOO (Reasoning Without Observation) 模式
    const agent = createDeepAgent({
      model: ctx.input.modelId,
      tools: ctx.input.tools ?? [],
      middleware: [
        // DeepAgents 内置中间件
        'planning',              // 任务分解 write_todos
        'filesystem',            // 文件系统 (sandbox)
        'subagents',             // 子 Agent 派发
      ],
      permissions: [{ type: 'read', path: '/data' }],
    });

    // 通过 LangGraph 流式执行
    const graph = agent.getGraph(); // 返回 CompiledStateGraph
    for await (const event of graph.stream({ messages: [userMessage] })) {
      // 映射为 WorkflowStepEvent 并写入 node_steps
    }
  }
}
```

### 6.3 DeepAgents 集成注意事项

- `deepagents` 包是 **Python 优先**的，JavaScript/TypeScript 版本能力可能不同。实际集成时需检查 npm `deepagents` 导出 API。
- 如果 JS 版 deepagents 不成熟，可**降级为纯 LangGraph 实现**（手动实现规划/子Agent 节点）
- DeepAgents 的 middleware 体系（filesystem/subagents/memory）可部分复用为我们的自定义节点

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
    await this.prisma.$transaction([
      this.prisma.workflow_edge.deleteMany({ where: { workflowId } }),
      this.prisma.workflow_node.deleteMany({ where: { workflowId } }),
      this.prisma.workflow_node.createMany({
        data: nodes.map((n) => ({
          workflowId,
          type: n.type,
          label: n.label,
          positionX: n.positionX,
          positionY: n.positionY,
          config: n.config ?? {},
        })),
      }),
      // ... edges.createMany (需要先查询刚插入的 node id 映射)
    ]);
  }
}
```

### 7.2 CreateWorkflowDto 改造

```typescript
// apps/api/src/modules/workflow/dto/create-workflow.dto.ts
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
```

---

## 8. V3 Designer 兼容（CustomStrategy）

模式 B 的 CustomStrategy 是 V3 Workflow Designer 的运行时：

```typescript
// apps/api/src/modules/workflow/strategies/custom.strategy.ts (V3+)
@Injectable()
export class CustomStrategy implements WorkflowStrategy {
  readonly type = 'custom';

  async *run(ctx: WorkflowExecutionContext): AsyncGenerator<WorkflowStepEvent> {
    const [nodes, edges] = await Promise.all([
      this.prisma.workflow_node.findMany({ where: { workflowId: ctx.workflow.id } }),
      this.prisma.workflow_edge.findMany({ where: { workflowId: ctx.workflow.id } }),
    ]);

    // 从 DB nodes/edges 编译为 LangGraph StateGraph
    const graph = this.compileGraph(nodes, edges);

    for await (const step of graph.stream(ctx.input)) {
      yield this.toEvent(step);
    }
  }

  /** 通用编译：DB nodes → LangGraph StateGraph */
  private compileGraph(nodes: WorkflowNode[], edges: WorkflowEdge[]): CompiledStateGraph {
    const builder = new StateGraph(AgentStateSchema);

    // 添加节点
    for (const node of nodes) {
      if (node.type === 'start' || node.type === 'end') continue;
      builder.addNode(node.id, this.registry.getNodeFn(node.type as WorkflowNodeType, node.config as any));
    }

    // 添加边（固定边 + 条件边）
    for (const edge of edges) {
      if (edge.condition) {
        // DB condition JSONB → LangGraph 条件路由函数
        builder.addConditionalEdges(edge.sourceNodeId, (state) => {
          return evaluateCondition(edge.condition, state) ? edge.targetNodeId : /* fallback */;
        });
      } else {
        builder.addEdge(edge.sourceNodeId, edge.targetNodeId);
      }
    }

    // 连接 start/end
    const startNode = nodes.find((n) => n.type === 'start');
    const endNode = nodes.find((n) => n.type === 'end');
    if (startNode) builder.addEdge(START, startNode.id);
    if (endNode) {
      // 所有无出边的节点 → end
    }

    return builder.compile();
  }
}
```

### condition 字段的 V3 使用

```
workflow_edges.condition JSONB 示例:

{"field": "judge_result", "operator": "equals", "value": "needs_improvement"}
```

编译为 LangGraph 条件边：

```typescript
builder.addConditionalEdges('judge', (state) => {
  const cond = edge.condition; // {"field": "judge_result", "equals": "needs_improvement"}
  const actual = extractField(state, cond.field);      // state.judgeResult
  if (cond.operator === 'equals' && actual === cond.value) {
    return 'retriever';  // 条件满足，重新检索
  }
  return 'end';          // 条件不满足，结束
});
```

---

## 9. 与现有模块的集成依赖

| 依赖 | 提供方 | 用途 |
|------|-------|------|
| `NodeRegistry` | `@nexus/ai-core` | 节点注册与发现 |
| `RetrievalService` | `apps/api` retrieval 模块 | RetrieverNode |
| `ModelCallerService` | `apps/api` model 模块 | LlmNode, ReflectionNode |
| `ToolExecutorService` | `apps/api` tool 模块 (V3) | ToolNode |
| `ChatProvider` | `@nexus/ai-core` | LLM 流式/非流式调用 |
| `AuditService` | `apps/api` audit-log 模块 | 审计横切 |
| `SessionLockService` | `apps/api` common 模块 | Chat 端并发控制 |

---

## 10. 实现计划

### Phase 1: 基础设施

| Task | 内容 |
|------|------|
| 1.1 | 安装 `@langchain/langgraph` / `@langchain/core` 依赖 |
| 1.2 | 创建 `packages/ai-core/src/workflow/`：AgentStateSchema、GraphNode 接口、NodeRegistry |
| 1.3 | 实现 11 种内置节点（Start/End/Retriever/LLM/Condition 先做，其余打桩） |
| 1.4 | WorkflowModule 内注册 NodeRegistry + 节点提供器 |
| 1.5 | 单测：NodeRegistry 注册/发现、节点 execute 签名 |

### Phase 2: 策略层

| Task | 内容 |
|------|------|
| 2.1 | 补全 WorkflowStrategy 接口、StrategyFactory |
| 2.2 | 实现 RagStrategy（retriever → llm → end） |
| 2.3 | 实现 ReflectionStrategy（retriever → llm → judge → retriever\|end） |
| 2.4 | ReWooStrategy / MultiAgentStrategy 抛 NotImplementdException（预留） |
| 2.5 | 单测：两种策略的图拓扑正确性、条件路由 |

### Phase 3: 执行层

| Task | 内容 |
|------|------|
| 3.1 | 实现 ExecutionService.execute() — 核心链路 |
| 3.2 | 实现 Controller 的 run/executions/listExecutions/resume 端点 |
| 3.3 | node_steps 持久化 + 审计日志 |
| 3.4 | 改造 WorkflowService CRUD 接真实 Prisma |
| 3.5 | 改造 CreateWorkflowDto 增加 config JSONB |
| 3.6 | 集成测试：POST /workflows → POST /run → GET /executions |

### Phase 4: 前端接线 + SSE

| Task | 内容 |
|------|------|
| 4.1 | 前端 `POST /:id/run` 接真实数据 |
| 4.2 | 前端 `GET /:id/executions` 接真实数据 |
| 4.3 | SSE 流式执行端点（`/workflows/:id/stream`） |
| 4.4 | WorkflowDetail 页显示真实执行历史 |

### Phase 5: V3 Designer 预留

| Task | 内容 |
|------|------|
| 5.1 | CustomStrategy + compileGraph 通用编译器 |
| 5.2 | DB nodes/edges → LangGraph StateGraph 的双向映射 |
| 5.3 | condition JSONB 表达式解析引擎 |
| 5.4 | Vue Flow Designer 拖拽 → 保存 → run 闭环 |

---

## 11. 附录: 与 DATABASE.md 的一致性检查

| DB 字段 | 设计中使用方式 | 一致性 |
|---------|--------------|--------|
| `workflows.type` | Mode A: `'rag'`/`'reflection'`/...; Mode B: `'custom'` | ✅ 新增 `'custom'` 枚举 |
| `workflows.config` | 策略参数注入（Mode A+B 都使用） | ✅ 一致 |
| `workflow_nodes` | Mode A: 可选同步（前端展示）；Mode B: 必须 | ✅ 表结构不变 |
| `workflow_edges` | Mode A: 可选同步，condition 留空；Mode B: 必须，condition 使用 | ✅ 表结构不变 |
| `workflow_edges.condition` | Mode A: 代码表达（不存 DB）；Mode B: JSONB 表达式编译为 LangGraph 条件边 | ✅ 按需使用 |
| `workflow_executions` | 两模式完全一致：status、duration_ms、node_steps JSONB | ✅ 完全一致 |
| `node_steps` 格式 | 与 DATABASE.md 对齐：node_id, node_type, status, input, output, duration_ms, started_at, completed_at | ✅ 一致 |
| `execution_status` 枚举 | RUNNING / COMPLETED / FAILED / CANCELLED / PAUSED / WAITING | ✅ 一致，PAUSED/WAITING 用于 resume 预留 |

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
│  ┌─────────── WorkflowModule ───────────────────────────────────┐   │
│  │                                                               │   │
│  │  ┌───── WorkflowService ─────┐  ┌───── ExecutionService ──┐  │   │
│  │  │ CRUD + graph sync        │  │ execute / resume / list  │  │   │
│  │  └──────────────────────────┘  └──────────┬───────────────┘  │   │
│  │                                           │                    │   │
│  │  ┌───── StrategyFactory ──────────────────┼─────────────┐    │   │
│  │  │  Rag │ Reflection │ ReWOO │ MultiAgent │ Custom     │    │   │
│  │  └────────────────────────────────────────┼─────────────┘    │   │
│  │                                           │                    │   │
│  │  ┌───── NodeRegistry ─────────────────────┴─────────────┐    │   │
│  │  │  retriever │ llm │ tool │ reflection │ planner │ ...  │    │   │
│  │  │  ┌──横切: 事件发射 → ExecutionService ─────────┐     │    │   │
│  │  └─────────────────────────────────────────────────────┘    │   │
│  └───────────────────────────────────────────────────────────────┘  │
│                              │                                       │
│  ┌────── @nexus/ai-core ────┼──────────────────────────────────┐   │
│  │  AgentStateSchema        │  LangGraph StateGraph             │   │
│  │  GraphNode interface      │  addNode / addEdge / stream      │   │
│  │  NodeRegistry             │  @langchain/langgraph            │   │
│  └───────────────────────────┼──────────────────────────────────┘   │
│                              │                                       │
│  ┌──── deepagents (可选) ────┼──────────────────────────────────┐   │
│  │  createDeepAgent          │  middleware: planning/subagents   │   │
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
└─────────────────────────────────────────────────────────────────────┘
```