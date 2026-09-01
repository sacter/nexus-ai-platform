# NexusAI Workflow Engine Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a LangGraph-powered Workflow Engine with Node Registry, Strategy-Defined Graphs, Execution Runtime, and SSE streaming support.

**Architecture:** 5-layer design — LangGraph Runtime (StateGraph/Annotation) → NodeRegistry (11 built-in nodes via DI) → Strategy-Defined Graphs (Rag/Reflection/ReWOO/MultiAgent) → Execution Runtime (persistence/timeout/batch write) → optional DeepAgents Harness for complex strategies. Two-mode compatibility: V2 code-driven (Mode A) + V3 Designer DB-driven (Mode B) via `CustomStrategy`.

**Tech Stack:** NestJS, Prisma (PostgreSQL), `@langchain/langgraph` (StateGraph/Annotation API), `@langchain/core`, `@nestjs/event-emitter`, class-validator, class-transformer

---

## File Structure

### New files to create:
| File | Responsibility |
|------|---------------|
| `apps/api/src/modules/workflow/state.ts` | `AgentStateAnnotation` via LangGraph `Annotation.Root` — shared state schema for all strategies |
| `apps/api/src/modules/workflow/node-registry.ts` | `GraphNode` interface, `NodeStepEvent`, `NodeContext`, `OnStepCallback`, `NodeRegistry` class |
| `apps/api/src/modules/workflow/nodes/start.node.ts` | StartNode — no-op init node |
| `apps/api/src/modules/workflow/nodes/end.node.ts` | EndNode — output aggregation node |
| `apps/api/src/modules/workflow/nodes/retriever.node.ts` | RetrieverNode — calls `RetrievalService.search()` |
| `apps/api/src/modules/workflow/nodes/llm.node.ts` | LlmNode — calls `ModelCallerService.resolveChatModel()` + `ChatProvider` |
| `apps/api/src/modules/workflow/nodes/condition.node.ts` | ConditionNode — evaluates state-based condition (used by ReflectionStrategy judge) |
| `apps/api/src/modules/workflow/nodes/reflection.node.ts` | ReflectionNode — quality check on LLM output |
| `apps/api/src/modules/workflow/strategies/workflow-strategy.factory.ts` | `StrategyFactory` — registry pattern, `register()`/`getStrategy()` |
| `apps/api/src/modules/workflow/strategies/rag.strategy.ts` | `RagStrategy` — `retriever → llm → end` |
| `apps/api/src/modules/workflow/strategies/reflection.strategy.ts` | `ReflectionStrategy` — `retriever → llm → judge ↺ retriever\|end` |
| `apps/api/src/modules/workflow/dto/execute-workflow.dto.ts` | `ExecuteWorkflowDto` — input for POST /run and /stream |
| `apps/api/src/modules/workflow/dto/pagination.dto.ts` | `PaginationDto` — shared pagination query params |
| `apps/api/src/modules/workflow/entities/node-step.entity.ts` | `NodeStepEvent` type (re-exported for clarity) |
| `apps/api/src/modules/workflow/workflow.types.ts` | Shared type aliases: `WorkflowType`, `ExecutionResponse`, `NodeStep`, `ChatMessage` |

### Existing files to modify:
| File | Change |
|------|--------|
| `apps/api/src/modules/workflow/workflow.module.ts` | Add imports (PrismaModule, RetrievalModule, ModelModule, EventEmitterModule), providers (NodeRegistry, all nodes, StrategyFactory, strategies), `onModuleInit` registration |
| `apps/api/src/modules/workflow/workflow.service.ts` | Replace placeholder CRUD with real Prisma queries + `syncGraphStructure()` |
| `apps/api/src/modules/workflow/workflow.controller.ts` | Add run/executions/stream/resume endpoints |
| `apps/api/src/modules/workflow/execution.service.ts` | Implement `execute()`, `executeStream()`, `resume()`, `listByWorkflow()`, `getById()` |
| `apps/api/src/modules/workflow/dto/create-workflow.dto.ts` | Add `nodes`/`edges` fields with `@ValidateNested` + `@Type(() => ...)` |
| `apps/api/src/modules/workflow/dto/update-workflow.dto.ts` | Extends `CreateWorkflowDto` (PartialType already works) |
| `apps/api/src/modules/workflow/strategies/workflow-strategy.interface.ts` | Replace empty interface with full `WorkflowStrategy` + `WorkflowExecutionContext` |
| `apps/api/src/modules/workflow/strategies/rewoo.strategy.ts` | Replace with `NotImplementedException` stub |
| `apps/api/src/modules/workflow/strategies/multi-agent.strategy.ts` | Replace with `NotImplementedException` stub |
| `apps/api/src/modules/workflow/entities/workflow.entity.ts` | Remove empty class or keep as-is |

### Test files to create:
| File | Responsibility |
|------|---------------|
| `apps/api/src/modules/workflow/state.spec.ts` | Test AgentState default values and reducer |
| `apps/api/src/modules/workflow/node-registry.spec.ts` | Test register/getNodeFn/resolve caching/error cases |
| `apps/api/src/modules/workflow/nodes/retriever.node.spec.ts` | Test RetrieverNode.execute() |
| `apps/api/src/modules/workflow/nodes/llm.node.spec.ts` | Test LlmNode.execute() |
| `apps/api/src/modules/workflow/strategies/rag.strategy.spec.ts` | Test RagStrategy graph topology and stream |
| `apps/api/src/modules/workflow/strategies/reflection.strategy.spec.ts` | Test ReflectionStrategy conditional edges |
| `apps/api/src/modules/workflow/strategies/workflow-strategy.factory.spec.ts` | Test StrategyFactory register/get/error |
| `apps/api/src/modules/workflow/execution.service.spec.ts` | Test execute flow (mock strategy + prisma) |

---

## Implementation Phases

### Phase 1: Infrastructure (LangGraph Runtime + Node Registry)

---

### Task 1.1: Install dependencies

**Files:**
- Modify: `apps/api/package.json`

- [ ] **Step 1: Add LangGraph dependencies**

```bash
cd apps/api && pnpm add @langchain/langgraph @langchain/core @langchain/langchain
```

- [ ] **Step 2: Verify installation**

Run: `node -e "require('@langchain/langgraph'); console.log('ok')"`
Expected: `ok`

- [ ] **Step 3: Commit**

```bash
cd apps/api
git add package.json pnpm-lock.yaml
git commit -m "feat: add @langchain/langgraph dependencies"
```

---

### Task 1.2: Create AgentState annotation

**Files:**
- Create: `apps/api/src/modules/workflow/state.ts`

- [ ] **Step 1: Write the state file**

```typescript
import { Annotation } from '@langchain/langgraph';
import { BaseMessage } from '@langchain/core/messages';

const messagesReducer = (prev: BaseMessage[], next: BaseMessage[]) => [...prev, ...next];

export const AgentStateAnnotation = Annotation.Root({
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

- [ ] **Step 2: Write unit test**

```typescript
// apps/api/src/modules/workflow/state.spec.ts
import { AgentStateAnnotation } from './state';

describe('AgentStateAnnotation', () => {
  it('should have default values', () => {
    const state = AgentStateAnnotation.default();
    expect(state.messages).toEqual([]);
    expect(state.iteration).toBe(0);
    expect(state.needsImprovement).toBe(false);
    expect(state.kbId).toBeUndefined();
    expect(state.kbIds).toEqual([]);
    expect(state.toolIds).toEqual([]);
    expect(state.toolResults).toEqual([]);
    expect(state.plan).toBeUndefined();
    expect(state.subtaskResults).toEqual([]);
    expect(state.agentOutputs).toEqual([]);
    expect(state.aggregatedResult).toBeUndefined();
    expect(state.context).toBeUndefined();
  });

  it('should append messages via reducer', () => {
    const msg1 = { type: 'human', content: 'hello' } as any;
    const msg2 = { type: 'ai', content: 'world' } as any;
    const result = AgentStateAnnotation.messages.reducer([msg1], [msg2]);
    expect(result).toHaveLength(2);
    expect(result[0]).toBe(msg1);
    expect(result[1]).toBe(msg2);
  });
});
```

- [ ] **Step 3: Run tests**

Run: `cd apps/api && npx jest src/modules/workflow/state.spec.ts --no-coverage`
Expected: 2 passed

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/modules/workflow/state.ts apps/api/src/modules/workflow/state.spec.ts
git commit -m "feat: add AgentStateAnnotation with LangGraph Annotation API"
```

---

### Task 1.3: Create NodeRegistry + GraphNode interface

**Files:**
- Create: `apps/api/src/modules/workflow/node-registry.ts`
- Create: `apps/api/src/modules/workflow/workflow.types.ts`

- [ ] **Step 1: Write workflow.types.ts**

```typescript
// apps/api/src/modules/workflow/workflow.types.ts
import { NodeStepEvent } from './node-registry';

export type WorkflowType = 'rag' | 'reflection' | 'rewoo' | 'multi_agent' | 'custom';

export type WorkflowNodeType =
  | 'start' | 'end' | 'retriever' | 'llm' | 'tool' | 'condition'
  | 'reflection' | 'planner' | 'solver' | 'aggregator' | 'code';

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface Tool {
  id: string;
  name: string;
  type: string;
  config?: Record<string, any>;
}

export interface ExecutionResponse {
  id: string;
  workflowId: string;
  status: string;
  input: any;
  output?: any;
  durationMs?: number;
  errorMessage?: string;
  nodeSteps: NodeStepEvent[];
  startedAt?: string;
  completedAt?: string;
  createdAt: string;
}

export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

export type NodeStep = NodeStepEvent;
```

- [ ] **Step 2: Write the NodeRegistry file**

```typescript
// apps/api/src/modules/workflow/node-registry.ts
import { Injectable } from '@nestjs/common';
import { RunnableConfig } from '@langchain/core/runnables';
import { AgentState } from './state';

/** 节点步骤回调 — 由 ExecutionService 提供 */
export type OnStepCallback = (event: NodeStepEvent) => void | Promise<void>;

/** 节点步骤事件 */
export interface NodeStepEvent {
  nodeId: string;
  nodeType: string;
  status: 'running' | 'completed' | 'failed' | 'skipped';
  input?: Record<string, any>;
  output?: Record<string, any>;
  durationMs?: number;
  errorMessage?: string;
  startedAt: string;
  completedAt?: string;
}

/** 节点执行上下文 */
export interface NodeContext {
  state: AgentState;
  config: RunnableConfig;
  metadata: {
    nodeId: string;
    nodeType: string;
    workflowId: string;
    executionId: string;
  };
  onStep: OnStepCallback;
}

/** 节点实现接口 */
export interface GraphNode {
  readonly type: string;
  readonly label: string;
  execute(ctx: NodeContext): Promise<Partial<AgentState>>;
  validateConfig?(config: Record<string, unknown>): boolean;
}

type GraphNodeFactory = (config?: Record<string, any>) => GraphNode;
type LangGraphNodeFn = (state: AgentState, config?: RunnableConfig) => Promise<Partial<AgentState>>;

@Injectable()
export class NodeRegistry {
  private factories = new Map<string, GraphNodeFactory>();
  private instances = new Map<string, GraphNode>();

  register(type: string, factory: GraphNodeFactory): void {
    if (this.factories.has(type)) {
      throw new Error(`Node type "${type}" already registered`);
    }
    this.factories.set(type, factory);
  }

  getNodeFn(
    type: string,
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

  private resolve(type: string, config?: Record<string, any>): GraphNode {
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

- [ ] **Step 3: Write unit test**

```typescript
// apps/api/src/modules/workflow/node-registry.spec.ts
import { NodeRegistry } from './node-registry';
import { GraphNode } from './node-registry';

describe('NodeRegistry', () => {
  let registry: NodeRegistry;

  beforeEach(() => {
    registry = new NodeRegistry();
  });

  it('should register and resolve a node', () => {
    const mockNode: GraphNode = {
      type: 'llm',
      label: 'LLM Node',
      execute: async () => ({ messages: [] }),
    };
    registry.register('llm', () => mockNode);
    const fn = registry.getNodeFn('llm');
    expect(fn).toBeDefined();
  });

  it('should throw on duplicate registration', () => {
    registry.register('llm', () => ({ type: 'llm', label: '', execute: async () => ({}) }));
    expect(() => registry.register('llm', () => ({ type: 'llm', label: '', execute: async () => ({}) })))
      .toThrow('already registered');
  });

  it('should throw on unknown node type', () => {
    expect(() => registry.getNodeFn('unknown'))
      .toThrow('Unknown node type');
  });

  it('should cache node instances by (type, config)', () => {
    const mockNode: GraphNode = { type: 'llm', label: '', execute: async () => ({}) };
    const factory = jest.fn(() => mockNode);
    registry.register('llm', factory);
    registry.getNodeFn('llm', { modelId: 'gpt-4' });
    registry.getNodeFn('llm', { modelId: 'gpt-4' });
    expect(factory).toHaveBeenCalledTimes(1);
  });

  it('should produce LangGraph-compatible node function', async () => {
    const mockNode: GraphNode = {
      type: 'llm',
      label: 'LLM',
      execute: async (ctx) => {
        expect(ctx.metadata.nodeId).toBe('test-node');
        return { messages: [], iteration: 1 };
      },
    };
    registry.register('llm', () => mockNode);
    const fn = registry.getNodeFn('llm', {}, async () => {});
    const result = await fn({} as any, { configurable: { nodeId: 'test-node' } } as any);
    expect(result.iteration).toBe(1);
  });
});
```

- [ ] **Step 4: Run tests**

Run: `cd apps/api && npx jest src/modules/workflow/node-registry.spec.ts --no-coverage`
Expected: 5 passed

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/modules/workflow/node-registry.ts apps/api/src/modules/workflow/workflow.types.ts apps/api/src/modules/workflow/node-registry.spec.ts
git commit -m "feat: add NodeRegistry with GraphNode interface and caching"
```

---

### Task 1.4: Implement 6 core built-in nodes

**Files:**
- Create: `apps/api/src/modules/workflow/nodes/start.node.ts`
- Create: `apps/api/src/modules/workflow/nodes/end.node.ts`
- Create: `apps/api/src/modules/workflow/nodes/retriever.node.ts`
- Create: `apps/api/src/modules/workflow/nodes/llm.node.ts`
- Create: `apps/api/src/modules/workflow/nodes/condition.node.ts`
- Create: `apps/api/src/modules/workflow/nodes/reflection.node.ts`

- [ ] **Step 1: Write StartNode**

```typescript
// apps/api/src/modules/workflow/nodes/start.node.ts
import { Injectable } from '@nestjs/common';
import { GraphNode, NodeContext } from '../node-registry';

@Injectable()
export class StartNode implements GraphNode {
  readonly type = 'start';
  readonly label = 'Start';

  async execute(ctx: NodeContext): Promise<Partial<import('../state').AgentState>> {
    return { ...ctx.state };
  }
}
```

- [ ] **Step 2: Write EndNode**

```typescript
// apps/api/src/modules/workflow/nodes/end.node.ts
import { Injectable } from '@nestjs/common';
import { GraphNode, NodeContext } from '../node-registry';

@Injectable()
export class EndNode implements GraphNode {
  readonly type = 'end';
  readonly label = 'End';

  async execute(ctx: NodeContext): Promise<Partial<import('../state').AgentState>> {
    // 结束节点：聚合最终输出，无需额外操作
    return {};
  }
}
```

- [ ] **Step 3: Write RetrieverNode**

```typescript
// apps/api/src/modules/workflow/nodes/retriever.node.ts
import { Injectable } from '@nestjs/common';
import { GraphNode, NodeContext } from '../node-registry';
import { RetrievalService } from '../../retrieval/retrieval.service';

@Injectable()
export class RetrieverNode implements GraphNode {
  readonly type = 'retriever';
  readonly label = 'Retriever';

  constructor(private readonly retrievalService: RetrievalService) {}

  async execute(ctx: NodeContext): Promise<Partial<import('../state').AgentState>> {
    const kbId = ctx.state.kbId ?? ctx.config?.configurable?.kbId;
    const topK = (ctx.config?.configurable as any)?.topK ?? 20;

    if (!kbId) {
      return { retrievedChunks: [], citations: [], error: 'No kbId provided' };
    }

    const result = await this.retrievalService.search({
      kbId,
      query: ctx.state.messages?.at(-1)?.content?.toString() ?? '',
      topK,
      strategy: 'hybrid',
    });

    return {
      retrievedChunks: result.chunks ?? [],
      citations: result.citations ?? [],
    };
  }
}
```

- [ ] **Step 4: Write LlmNode**

```typescript
// apps/api/src/modules/workflow/nodes/llm.node.ts
import { Injectable } from '@nestjs/common';
import { GraphNode, NodeContext } from '../node-registry';
import { ModelCallerService } from '../../model/model-caller.service';
import { AIMessage, HumanMessage, SystemMessage } from '@langchain/core/messages';

@Injectable()
export class LlmNode implements GraphNode {
  readonly type = 'llm';
  readonly label = 'LLM';

  constructor(private readonly modelCallerService: ModelCallerService) {}

  async execute(ctx: NodeContext): Promise<Partial<import('../state').AgentState>> {
    const modelId = ctx.state.modelId ?? (ctx.config?.configurable as any)?.modelId;
    const temperature = (ctx.config?.configurable as any)?.temperature ?? 0.7;

    if (!modelId) {
      return { error: 'No modelId provided' };
    }

    const { client, modelName, baseConfig } = await this.modelCallerService.resolveChatModel(modelId);

    // 构建消息列表
    const messages = ctx.state.messages ?? [];

    const response = await client.invoke({
      model: modelName,
      messages: messages.map((m: any) => {
        if (m._getType) return m; // 已经是 BaseMessage 实例
        if (m.type === 'human' || m.role === 'user') return new HumanMessage(m.content ?? '');
        if (m.type === 'ai' || m.role === 'assistant') return new AIMessage(m.content ?? '');
        if (m.type === 'system' || m.role === 'system') return new SystemMessage(m.content ?? '');
        return new HumanMessage(String(m.content ?? ''));
      }),
      temperature: temperature ?? baseConfig.temperature,
      maxTokens: baseConfig.maxTokens ?? 4096,
    });

    const content = typeof response.content === 'string' ? response.content : JSON.stringify(response.content);

    return {
      messages: [new AIMessage({ content })],
    };
  }
}
```

- [ ] **Step 5: Write ConditionNode**

```typescript
// apps/api/src/modules/workflow/nodes/condition.node.ts
import { Injectable } from '@nestjs/common';
import { GraphNode, NodeContext } from '../node-registry';

@Injectable()
export class ConditionNode implements GraphNode {
  readonly type = 'condition';
  readonly label = 'Condition';

  async execute(ctx: NodeContext): Promise<Partial<import('../state').AgentState>> {
    // 条件节点由 addConditionalEdges 的路由函数处理，
    // 此处仅作占位节点，实际路由逻辑在策略的条件边中定义
    return {};
  }
}
```

- [ ] **Step 6: Write ReflectionNode**

```typescript
// apps/api/src/modules/workflow/nodes/reflection.node.ts
import { Injectable, Logger } from '@nestjs/common';
import { GraphNode, NodeContext } from '../node-registry';
import { ModelCallerService } from '../../model/model-caller.service';
import { AIMessage } from '@langchain/core/messages';

@Injectable()
export class ReflectionNode implements GraphNode {
  readonly type = 'reflection';
  readonly label = 'Reflection Judge';
  private readonly logger = new Logger(ReflectionNode.name);

  constructor(private readonly modelCallerService: ModelCallerService) {}

  async execute(ctx: NodeContext): Promise<Partial<import('../state').AgentState>> {
    const lastMessage = ctx.state.messages?.at(-1)?.content?.toString() ?? '';
    const iteration = (ctx.state.iteration ?? 0) + 1;

    // 使用简单规则判断质量（可替换为 LLM judge）
    const needsImprovement = lastMessage.length < 20 || lastMessage.includes('不确定');
    const judgeResult = needsImprovement ? 'needs_improvement' : 'approved';

    return {
      iteration,
      needsImprovement,
      judgeResult,
    };
  }
}
```

- [ ] **Step 7: Write unit tests for RetrieverNode and LlmNode**

```typescript
// apps/api/src/modules/workflow/nodes/retriever.node.spec.ts
import { Test } from '@nestjs/testing';
import { RetrieverNode } from './retriever.node';
import { RetrievalService } from '../../retrieval/retrieval.service';

describe('RetrieverNode', () => {
  let node: RetrieverNode;
  const mockRetrievalService = {
    search: jest.fn().mockResolvedValue({ chunks: [], citations: [] }),
  };

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        RetrieverNode,
        { provide: RetrievalService, useValue: mockRetrievalService },
      ],
    }).compile();
    node = module.get(RetrieverNode);
  });

  it('should return error when no kbId', async () => {
    const result = await node.execute({
      state: { messages: [], kbId: undefined } as any,
      config: { configurable: {} } as any,
      metadata: { nodeId: 'r1', nodeType: 'retriever', workflowId: 'w1', executionId: 'e1' },
      onStep: jest.fn(),
    });
    expect(result.error).toContain('No kbId');
  });

  it('should call retrievalService.search', async () => {
    await node.execute({
      state: { messages: [{ content: 'test query' }], kbId: 'kb-1' } as any,
      config: { configurable: { kbId: 'kb-1', topK: 10 } } as any,
      metadata: { nodeId: 'r1', nodeType: 'retriever', workflowId: 'w1', executionId: 'e1' },
      onStep: jest.fn(),
    });
    expect(mockRetrievalService.search).toHaveBeenCalled();
  });
});
```

```typescript
// apps/api/src/modules/workflow/nodes/llm.node.spec.ts
import { Test } from '@nestjs/testing';
import { LlmNode } from './llm.node';
import { ModelCallerService } from '../../model/model-caller.service';

describe('LlmNode', () => {
  let node: LlmNode;
  const mockModelCaller = {
    resolveChatModel: jest.fn().mockResolvedValue({
      client: { invoke: jest.fn().mockResolvedValue({ content: 'AI response' }) },
      modelName: 'gpt-4',
      baseConfig: { temperature: 0.7, maxTokens: 4096 },
    }),
  };

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        LlmNode,
        { provide: ModelCallerService, useValue: mockModelCaller },
      ],
    }).compile();
    node = module.get(LlmNode);
  });

  it('should return error when no modelId', async () => {
    const result = await node.execute({
      state: { messages: [], modelId: undefined } as any,
      config: { configurable: {} } as any,
      metadata: { nodeId: 'l1', nodeType: 'llm', workflowId: 'w1', executionId: 'e1' },
      onStep: jest.fn(),
    });
    expect(result.error).toContain('No modelId');
  });

  it('should call modelCallerService.resolveChatModel', async () => {
    await node.execute({
      state: { messages: [{ content: 'hello', role: 'user' }], modelId: 'm1' } as any,
      config: { configurable: { modelId: 'm1' } } as any,
      metadata: { nodeId: 'l1', nodeType: 'llm', workflowId: 'w1', executionId: 'e1' },
      onStep: jest.fn(),
    });
    expect(mockModelCaller.resolveChatModel).toHaveBeenCalledWith('m1');
  });
});
```

- [ ] **Step 8: Run all node tests**

Run: `cd apps/api && npx jest src/modules/workflow/nodes/ --no-coverage`
Expected: 4 passed

- [ ] **Step 9: Commit**

```bash
git add apps/api/src/modules/workflow/nodes/
git add apps/api/src/modules/workflow/nodes/retriever.node.spec.ts apps/api/src/modules/workflow/nodes/llm.node.spec.ts
git commit -m "feat: implement 6 core nodes (start/end/retriever/llm/condition/reflection)"
```

---

### Task 1.5: Update WorkflowModule with onModuleInit registration

**Files:**
- Modify: `apps/api/src/modules/workflow/workflow.module.ts`

- [ ] **Step 1: Update module with imports and onModuleInit**

```typescript
import { Module, OnModuleInit } from '@nestjs/common';
import { WorkflowService } from './workflow.service';
import { WorkflowController } from './workflow.controller';
import { ExecutionService } from './execution.service';
import { NodeRegistry } from './node-registry';
import { StartNode } from './nodes/start.node';
import { EndNode } from './nodes/end.node';
import { RetrieverNode } from './nodes/retriever.node';
import { LlmNode } from './nodes/llm.node';
import { ConditionNode } from './nodes/condition.node';
import { ReflectionNode } from './nodes/reflection.node';
import { StrategyFactory } from './strategies/workflow-strategy.factory';
import { RagStrategy } from './strategies/rag.strategy';
import { ReflectionStrategy } from './strategies/reflection.strategy';
import { PrismaModule } from '@nexus/database';
import { RetrievalModule } from '../retrieval/retrieval.module';
import { ModelModule } from '../model/model.module';

@Module({
  imports: [
    PrismaModule,
    RetrievalModule,
    ModelModule,
  ],
  controllers: [WorkflowController],
  providers: [
    WorkflowService,
    ExecutionService,
    NodeRegistry,
    StrategyFactory,

    // 内置节点
    StartNode,
    EndNode,
    ConditionNode,
    {
      provide: RetrieverNode,
      useFactory: (svc: import('../../retrieval/retrieval.service').RetrievalService) => new RetrieverNode(svc),
      inject: [import('../../retrieval/retrieval.service').RetrievalService],
    },
    {
      provide: LlmNode,
      useFactory: (svc: import('../../model/model-caller.service').ModelCallerService) => new LlmNode(svc),
      inject: [import('../../model/model-caller.service').ModelCallerService],
    },
    {
      provide: ReflectionNode,
      useFactory: (svc: import('../../model/model-caller.service').ModelCallerService) => new ReflectionNode(svc),
      inject: [import('../../model/model-caller.service').ModelCallerService],
    },

    // 策略
    RagStrategy,
    ReflectionStrategy,
  ],
  exports: [ExecutionService, WorkflowService, NodeRegistry],
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

    // 注册策略
    this.strategyFactory.register(this.ragStrategy);
    this.strategyFactory.register(this.reflectionStrategy);
  }
}
```

- [ ] **Step 2: Verify module compiles**

Run: `cd apps/api && npx tsc --noEmit --pretty 2>&1 | head -30`
Expected: No errors related to WorkflowModule

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/modules/workflow/workflow.module.ts
git commit -m "feat: update WorkflowModule with onModuleInit node/strategy registration"
```

---

### Phase 2: Strategy Layer

---

### Task 2.1: Update WorkflowStrategy interface + StrategyFactory

**Files:**
- Modify: `apps/api/src/modules/workflow/strategies/workflow-strategy.interface.ts`
- Create: `apps/api/src/modules/workflow/strategies/workflow-strategy.factory.ts`

- [ ] **Step 1: Write the complete interface**

```typescript
// apps/api/src/modules/workflow/strategies/workflow-strategy.interface.ts
import { NodeStepEvent, OnStepCallback } from '../node-registry';
import { WorkflowType, ChatMessage, Tool } from '../workflow.types';

/** 策略运行上下文 — 由 ExecutionService 装配 */
export interface WorkflowExecutionContext {
  workflow: {
    id: string;
    type: WorkflowType;
    config: Record<string, any>;
  };
  executionId: string;
  input: {
    question: string;
    chatHistory?: ChatMessage[];
    kbIds?: string[];
    modelId?: string;
    tools?: Tool[];
  };
  onStep: OnStepCallback;
  signal?: AbortSignal;
  timeoutMs?: number;
}

export interface WorkflowStrategy {
  readonly type: WorkflowType;
  run(ctx: WorkflowExecutionContext): AsyncGenerator<NodeStepEvent, void, void>;
}
```

- [ ] **Step 2: Write StrategyFactory**

```typescript
// apps/api/src/modules/workflow/strategies/workflow-strategy.factory.ts
import { Injectable, BadRequestException, NotImplementedException } from '@nestjs/common';
import { WorkflowStrategy } from './workflow-strategy.interface';
import { WorkflowType } from '../workflow.types';

@Injectable()
export class StrategyFactory {
  private strategies = new Map<WorkflowType, WorkflowStrategy>();

  register(strategy: WorkflowStrategy): void {
    if (this.strategies.has(strategy.type)) {
      throw new Error(`Strategy for type "${strategy.type}" already registered`);
    }
    this.strategies.set(strategy.type, strategy);
  }

  getStrategy(type: WorkflowType): WorkflowStrategy {
    const strategy = this.strategies.get(type);
    if (!strategy) {
      if (type === 'rewoo' || type === 'multi_agent' || type === 'custom') {
        throw new NotImplementedException(`${type} strategy is V3+`);
      }
      throw new BadRequestException(`Unknown workflow type: ${type}`);
    }
    return strategy;
  }
}
```

- [ ] **Step 3: Write unit test**

```typescript
// apps/api/src/modules/workflow/strategies/workflow-strategy.factory.spec.ts
import { StrategyFactory } from './workflow-strategy.factory';
import { WorkflowStrategy } from './workflow-strategy.interface';
import { NotImplementedException, BadRequestException } from '@nestjs/common';

describe('StrategyFactory', () => {
  let factory: StrategyFactory;

  beforeEach(() => {
    factory = new StrategyFactory();
  });

  it('should register and retrieve a strategy', () => {
    const mockStrategy = { type: 'rag' as const, run: jest.fn() };
    factory.register(mockStrategy);
    expect(factory.getStrategy('rag')).toBe(mockStrategy);
  });

  it('should throw on duplicate registration', () => {
    const mock = { type: 'rag' as const, run: jest.fn() };
    factory.register(mock);
    expect(() => factory.register(mock)).toThrow('already registered');
  });

  it('should throw NotImplementedException for V3+ strategies', () => {
    expect(() => factory.getStrategy('rewoo')).toThrow(NotImplementedException);
    expect(() => factory.getStrategy('multi_agent')).toThrow(NotImplementedException);
    expect(() => factory.getStrategy('custom')).toThrow(NotImplementedException);
  });

  it('should throw BadRequestException for unknown type', () => {
    expect(() => factory.getStrategy('unknown' as any)).toThrow(BadRequestException);
  });
});
```

- [ ] **Step 4: Run tests**

Run: `cd apps/api && npx jest src/modules/workflow/strategies/workflow-strategy.factory.spec.ts --no-coverage`
Expected: 4 passed

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/modules/workflow/strategies/workflow-strategy.interface.ts apps/api/src/modules/workflow/strategies/workflow-strategy.factory.ts apps/api/src/modules/workflow/strategies/workflow-strategy.factory.spec.ts
git commit -m "feat: add WorkflowStrategy interface and StrategyFactory"
```

---

### Task 2.2: Implement RagStrategy

**Files:**
- Write: `apps/api/src/modules/workflow/strategies/rag.strategy.ts`

- [ ] **Step 1: Write the RagStrategy implementation**

```typescript
// apps/api/src/modules/workflow/strategies/rag.strategy.ts
import { Injectable } from '@nestjs/common';
import { StateGraph, START, END } from '@langchain/langgraph';
import { HumanMessage, AIMessage } from '@langchain/core/messages';
import { NodeRegistry, NodeStepEvent } from '../node-registry';
import { AgentStateAnnotation } from '../state';
import { WorkflowStrategy, WorkflowExecutionContext } from './workflow-strategy.interface';

@Injectable()
export class RagStrategy implements WorkflowStrategy {
  readonly type = 'rag';

  constructor(private readonly registry: NodeRegistry) {}

  async *run(ctx: WorkflowExecutionContext): AsyncGenerator<NodeStepEvent> {
    const config = ctx.workflow.config;
    const { question, chatHistory, kbIds, modelId } = ctx.input;

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

    const input = {
      messages: [
        ...(chatHistory ?? []).map(m =>
          m.role === 'user' ? new HumanMessage(m.content) : new AIMessage(m.content)
        ),
        new HumanMessage(question),
      ],
      kbId: kbIds?.[0],
      modelId: modelId ?? config.llm?.modelId,
    };

    try {
      for await (const event of graph.stream(input, {
        configurable: { workflowId: ctx.workflow.id, executionId: ctx.executionId },
        signal: ctx.signal,
      })) {
        for (const [nodeName, output] of Object.entries(event)) {
          yield {
            nodeId: nodeName,
            nodeType: this.resolveNodeType(nodeName),
            status: (output as any)?.error ? 'failed' : 'completed',
            input: { question },
            output: output as Record<string, any>,
            durationMs: 0,
            startedAt: new Date().toISOString(),
            completedAt: new Date().toISOString(),
          };
        }
      }
    } catch (err: any) {
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

  private resolveNodeType(nodeName: string): string {
    const map: Record<string, string> = {
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

- [ ] **Step 2: Write unit test**

```typescript
// apps/api/src/modules/workflow/strategies/rag.strategy.spec.ts
import { RagStrategy } from './rag.strategy';
import { NodeRegistry } from '../node-registry';
import { WorkflowExecutionContext } from './workflow-strategy.interface';

describe('RagStrategy', () => {
  let strategy: RagStrategy;
  let registry: NodeRegistry;

  beforeEach(() => {
    registry = new NodeRegistry();
    // Register mock nodes
    registry.register('retriever', () => ({
      type: 'retriever', label: 'Retriever',
      execute: async () => ({ retrievedChunks: [{ id: 'c1' }], citations: [] }),
    }));
    registry.register('llm', () => ({
      type: 'llm', label: 'LLM',
      execute: async () => ({ messages: [{ content: 'AI answer', type: 'ai' }] }),
    }));
    strategy = new RagStrategy(registry);
  });

  it('should have type "rag"', () => {
    expect(strategy.type).toBe('rag');
  });

  it('should yield node step events', async () => {
    const ctx: WorkflowExecutionContext = {
      workflow: { id: 'w1', type: 'rag', config: {} },
      executionId: 'e1',
      input: { question: 'test query', kbIds: ['kb-1'] },
      onStep: async () => {},
    };

    const events: any[] = [];
    for await (const event of strategy.run(ctx)) {
      events.push(event);
    }
    expect(events.length).toBeGreaterThan(0);
    expect(events.every(e => e.nodeId)).toBe(true);
  });
});
```

- [ ] **Step 3: Run tests**

Run: `cd apps/api && npx jest src/modules/workflow/strategies/rag.strategy.spec.ts --no-coverage`
Expected: 2 passed

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/modules/workflow/strategies/rag.strategy.ts apps/api/src/modules/workflow/strategies/rag.strategy.spec.ts
git commit -m "feat: implement RagStrategy (retriever → llm → end)"
```

---

### Task 2.3: Implement ReflectionStrategy

**Files:**
- Write: `apps/api/src/modules/workflow/strategies/reflection.strategy.ts`

- [ ] **Step 1: Write the ReflectionStrategy implementation**

```typescript
// apps/api/src/modules/workflow/strategies/reflection.strategy.ts
import { Injectable } from '@nestjs/common';
import { StateGraph, START, END } from '@langchain/langgraph';
import { HumanMessage, AIMessage } from '@langchain/core/messages';
import { NodeRegistry, NodeStepEvent } from '../node-registry';
import { AgentStateAnnotation } from '../state';
import { WorkflowStrategy, WorkflowExecutionContext } from './workflow-strategy.interface';

@Injectable()
export class ReflectionStrategy implements WorkflowStrategy {
  readonly type = 'reflection';

  constructor(private readonly registry: NodeRegistry) {}

  async *run(ctx: WorkflowExecutionContext): AsyncGenerator<NodeStepEvent> {
    const maxIterations = ctx.workflow.config.maxIterations ?? 3;
    const { question, chatHistory, kbIds, modelId } = ctx.input;

    const graph = new StateGraph(AgentStateAnnotation)
      .addNode('retriever', this.registry.getNodeFn('retriever', {
        kbId: kbIds?.[0], topK: ctx.workflow.config.retriever?.topK ?? 20,
      }, ctx.onStep))
      .addNode('llm', this.registry.getNodeFn('llm', {
        modelId: modelId ?? ctx.workflow.config.llm?.modelId,
        temperature: ctx.workflow.config.llm?.temperature ?? 0.7,
      }, ctx.onStep))
      .addNode('judge', this.registry.getNodeFn('reflection', ctx.workflow.config.reflection, ctx.onStep))
      .addEdge(START, 'retriever')
      .addEdge('retriever', 'llm')
      .addEdge('llm', 'judge')
      .addConditionalEdges('judge', (state: any) => {
        const iteration = state.iteration ?? 0;
        if (state.needsImprovement && iteration < maxIterations) {
          return 'retriever';
        }
        return END;
      })
      .compile();

    const input = {
      messages: [
        ...(chatHistory ?? []).map(m =>
          m.role === 'user' ? new HumanMessage(m.content) : new AIMessage(m.content)
        ),
        new HumanMessage(question),
      ],
      kbId: kbIds?.[0],
      modelId: modelId ?? ctx.workflow.config.llm?.modelId,
    };

    try {
      for await (const event of graph.stream(input, {
        configurable: { workflowId: ctx.workflow.id, executionId: ctx.executionId },
        signal: ctx.signal,
      })) {
        for (const [nodeName, output] of Object.entries(event)) {
          yield {
            nodeId: nodeName,
            nodeType: this.resolveNodeType(nodeName),
            status: (output as any)?.error ? 'failed' : 'completed',
            input: { question },
            output: output as Record<string, any>,
            durationMs: 0,
            startedAt: new Date().toISOString(),
            completedAt: new Date().toISOString(),
          };
        }
      }
    } catch (err: any) {
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

  private resolveNodeType(nodeName: string): string {
    const map: Record<string, string> = {
      'retriever': 'retriever',
      'llm': 'llm',
      'judge': 'reflection',
    };
    return map[nodeName] ?? 'llm';
  }
}
```

- [ ] **Step 2: Write unit test**

```typescript
// apps/api/src/modules/workflow/strategies/reflection.strategy.spec.ts
import { ReflectionStrategy } from './reflection.strategy';
import { NodeRegistry } from '../node-registry';
import { WorkflowExecutionContext } from './workflow-strategy.interface';

describe('ReflectionStrategy', () => {
  let strategy: ReflectionStrategy;
  let registry: NodeRegistry;

  beforeEach(() => {
    registry = new NodeRegistry();
    registry.register('retriever', () => ({
      type: 'retriever', label: 'Retriever',
      execute: async () => ({ retrievedChunks: [], citations: [] }),
    }));
    registry.register('llm', () => ({
      type: 'llm', label: 'LLM',
      execute: async () => ({ messages: [{ content: 'answer', type: 'ai' }] }),
    }));
    registry.register('reflection', () => ({
      type: 'reflection', label: 'Judge',
      execute: async () => ({ iteration: 1, needsImprovement: false, judgeResult: 'approved' }),
    }));
    strategy = new ReflectionStrategy(registry);
  });

  it('should have type "reflection"', () => {
    expect(strategy.type).toBe('reflection');
  });

  it('should yield step events', async () => {
    const ctx: WorkflowExecutionContext = {
      workflow: { id: 'w1', type: 'reflection', config: { maxIterations: 3 } },
      executionId: 'e1',
      input: { question: 'test' },
      onStep: async () => {},
    };

    const events: any[] = [];
    for await (const event of strategy.run(ctx)) {
      events.push(event);
    }
    expect(events.length).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 3: Run tests**

Run: `cd apps/api && npx jest src/modules/workflow/strategies/reflection.strategy.spec.ts --no-coverage`
Expected: 2 passed

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/modules/workflow/strategies/reflection.strategy.ts apps/api/src/modules/workflow/strategies/reflection.strategy.spec.ts
git commit -m "feat: implement ReflectionStrategy with conditional edges"
```

---

### Task 2.4: Stub V3+ strategies (ReWOO / MultiAgent) with NotImplementedException

**Files:**
- Modify: `apps/api/src/modules/workflow/strategies/rewoo.strategy.ts`
- Modify: `apps/api/src/modules/workflow/strategies/multi-agent.strategy.ts`

- [ ] **Step 1: Write ReWOO stub**

```typescript
// apps/api/src/modules/workflow/strategies/rewoo.strategy.ts
import { Injectable, NotImplementedException } from '@nestjs/common';
import { WorkflowStrategy, WorkflowExecutionContext } from './workflow-strategy.interface';
import { NodeStepEvent } from '../node-registry';

@Injectable()
export class ReWooStrategy implements WorkflowStrategy {
  readonly type = 'rewoo';

  async *run(_ctx: WorkflowExecutionContext): AsyncGenerator<NodeStepEvent> {
    throw new NotImplementedException('ReWOO strategy is V3+');
  }
}
```

- [ ] **Step 2: Write MultiAgent stub**

```typescript
// apps/api/src/modules/workflow/strategies/multi-agent.strategy.ts
import { Injectable, NotImplementedException } from '@nestjs/common';
import { WorkflowStrategy, WorkflowExecutionContext } from './workflow-strategy.interface';
import { NodeStepEvent } from '../node-registry';

@Injectable()
export class MultiAgentStrategy implements WorkflowStrategy {
  readonly type = 'multi_agent';

  async *run(_ctx: WorkflowExecutionContext): AsyncGenerator<NodeStepEvent> {
    throw new NotImplementedException('MultiAgent strategy is V3+');
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/modules/workflow/strategies/rewoo.strategy.ts apps/api/src/modules/workflow/strategies/multi-agent.strategy.ts
git commit -m "feat: stub V3+ strategies (ReWOO/MultiAgent) with NotImplementedException"
```

---

### Task 2.5: Verify npm deepagents availability

- [ ] **Step 1: Check npm for deepagents package**

Run: `npm view deepagents --json 2>/dev/null | head -30 || echo "deepagents not found on npm"`
Expected: Whether the package exists (likely not — proceed with Plan B documentation)

- [ ] **Step 2: Document findings in a comment**

Add a note in `apps/api/src/modules/workflow/strategies/rewoo.strategy.ts`:

```typescript
// Plan B: 2026-09-01 — deepagents npm package not available.
// V3+ ReWOO will be implemented with pure LangGraph (Plan B).
```

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/modules/workflow/strategies/rewoo.strategy.ts
git commit -m "chore: document deepagents npm availability — Plan B confirmed"
```

---

### Phase 3: Execution Layer

---

### Task 3.1: Implement ExecutionService.execute() core

**Files:**
- Modify: `apps/api/src/modules/workflow/execution.service.ts`
- Create: `apps/api/src/modules/workflow/dto/execute-workflow.dto.ts`
- Create: `apps/api/src/modules/workflow/dto/pagination.dto.ts`

- [ ] **Step 1: Write ExecuteWorkflowDto**

```typescript
// apps/api/src/modules/workflow/dto/execute-workflow.dto.ts
import { IsString, IsOptional, IsArray, IsObject } from 'class-validator';

export class ExecuteWorkflowDto {
  @IsString()
  question!: string;

  @IsOptional()
  @IsArray()
  @IsObject({ each: true })
  chatHistory?: { role: string; content: string }[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  kbIds?: string[];

  @IsOptional()
  @IsString()
  modelId?: string;
}
```

- [ ] **Step 2: Write PaginationDto**

```typescript
// apps/api/src/modules/workflow/dto/pagination.dto.ts
import { IsOptional, IsInt, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';

export class PaginationDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize: number = 20;
}
```

- [ ] **Step 3: Implement ExecutionService**

```typescript
// apps/api/src/modules/workflow/execution.service.ts
import { Injectable, HttpException, NotImplementedException, BadRequestException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '@nexus/database';
import { StrategyFactory } from './strategies/workflow-strategy.factory';
import { WorkflowExecutionContext } from './strategies/workflow-strategy.interface';
import { NodeStepEvent } from './node-registry';
import { ExecuteWorkflowDto } from './dto/execute-workflow.dto';
import { PaginationDto } from './dto/pagination.dto';
import { WorkflowType, ExecutionResponse, NodeStep } from './workflow.types';

@Injectable()
export class ExecutionService {
  private static readonly STEP_BATCH_SIZE = 10;
  private static readonly MAX_CONCURRENT_PER_USER = 5;

  constructor(
    private readonly strategyFactory: StrategyFactory,
    private readonly prisma: PrismaService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async execute(
    workflowId: string,
    input: ExecuteWorkflowDto,
    userId: string,
  ): Promise<ExecutionResponse> {
    const workflow = await this.prisma.workflow.findUniqueOrThrow({
      where: { id: workflowId },
    });

    await this.checkConcurrencyLimit(userId);

    const strategy = this.strategyFactory.getStrategy(workflow.type as WorkflowType);
    const timeoutMs = (workflow.config as any)?.timeoutMs ?? 300_000;
    const abortController = new AbortController();

    const execution = await this.prisma.workflow_executions.create({
      data: {
        workflowId,
        input: input as any,
        status: 'RUNNING',
        startedAt: new Date(),
      },
    });

    const nodeSteps: NodeStep[] = [];
    const onStep = async (event: NodeStepEvent) => {
      nodeSteps.push(event);
      this.eventEmitter.emit('workflow.step', { executionId: execution.id, event });
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
      const timeoutId = setTimeout(() => abortController.abort(), timeoutMs);

      for await (const _event of strategy.run(ctx)) {
        // 事件已在 onStep 中处理
      }
      clearTimeout(timeoutId);

      const duration = Date.now() - startTime;
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

      // 审计日志（不阻塞）
      this.recordAudit(workflowId).catch(() => {});

      return this.toResponse(result);
    } catch (err: any) {
      const duration = Date.now() - startTime;
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

  async resume(executionId: string): Promise<ExecutionResponse> {
    const execution = await this.prisma.workflow_executions.findUniqueOrThrow({
      where: { id: executionId },
    });
    if (execution.status !== 'PAUSED' && execution.status !== 'WAITING') {
      throw new BadRequestException(`Cannot resume execution in status: ${execution.status}`);
    }
    throw new NotImplementedException('Resume is V3+');
  }

  private async persistNodeSteps(executionId: string, steps: NodeStep[]): Promise<void> {
    await this.prisma.workflow_executions.update({
      where: { id: executionId },
      data: { nodeSteps: steps as any },
    });
  }

  async listByWorkflow(workflowId: string, query: PaginationDto): Promise<{ items: any[]; total: number; page: number; pageSize: number }> {
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

  async getById(workflowId: string, execId: string): Promise<any> {
    return this.prisma.workflow_executions.findFirstOrThrow({
      where: { id: execId, workflowId },
    });
  }

  /**
   * 流式执行 — 供 SSE 端点调用
   * 返回 AsyncGenerator，由 Controller 消费
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

    await this.prisma.workflow_executions.create({
      data: { id: executionId, workflowId, input: input as any, status: 'RUNNING', startedAt: new Date() },
    });

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

  private async checkConcurrencyLimit(userId: string): Promise<void> {
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

  private async recordAudit(workflowId: string): Promise<void> {
    try {
      // 审计日志：workflow_execute 事件
      this.eventEmitter.emit('audit.record', {
        action: 'WORKFLOW_EXECUTE',
        entityType: 'workflow',
        entityId: workflowId,
      });
    } catch {
      // 审计日志不阻塞执行
    }
  }

  private extractAnswer(steps: NodeStep[]): string {
    const llmSteps = steps.filter(s => s.nodeType === 'llm' && s.status === 'completed');
    const last = llmSteps[llmSteps.length - 1];
    return (last?.output as any)?.messages?.[0]?.content ?? '';
  }

  private extractCitations(steps: NodeStep[]): any[] {
    const retrieverSteps = steps.filter(s => s.nodeType === 'retriever' && s.status === 'completed');
    const last = retrieverSteps[retrieverSteps.length - 1];
    return (last?.output as any)?.citations ?? [];
  }

  private toResponse(result: any): ExecutionResponse {
    return {
      id: result.id,
      workflowId: result.workflowId,
      status: result.status,
      input: result.input,
      output: result.output,
      durationMs: result.durationMs,
      errorMessage: result.errorMessage,
      nodeSteps: result.nodeSteps ?? [],
      startedAt: result.startedAt?.toISOString?.() ?? result.startedAt,
      completedAt: result.completedAt?.toISOString?.() ?? result.completedAt,
      createdAt: result.createdAt?.toISOString?.() ?? result.createdAt,
    };
  }
}
```

- [ ] **Step 4: Write unit test**

```typescript
// apps/api/src/modules/workflow/execution.service.spec.ts
import { Test } from '@nestjs/testing';
import { ExecutionService } from './execution.service';
import { StrategyFactory } from './strategies/workflow-strategy.factory';
import { PrismaService } from '@nexus/database';
import { EventEmitter2 } from '@nestjs/event-emitter';

describe('ExecutionService', () => {
  let service: ExecutionService;
  const mockPrisma = {
    workflow: { findUniqueOrThrow: jest.fn() },
    workflow_executions: {
      create: jest.fn(),
      update: jest.fn(),
      findMany: jest.fn(),
      findFirstOrThrow: jest.fn(),
      findUniqueOrThrow: jest.fn(),
      count: jest.fn().mockResolvedValue(0),
    },
  };
  const mockStrategyFactory = {
    getStrategy: jest.fn(),
  };
  const mockEventEmitter = {
    emit: jest.fn(),
  };

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        ExecutionService,
        { provide: StrategyFactory, useValue: mockStrategyFactory },
        { provide: PrismaService, useValue: mockPrisma },
        { provide: EventEmitter2, useValue: mockEventEmitter },
      ],
    }).compile();
    service = module.get(ExecutionService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should listByWorkflow', async () => {
    mockPrisma.workflow_executions.findMany.mockResolvedValue([]);
    mockPrisma.workflow_executions.count.mockResolvedValue(0);
    const result = await service.listByWorkflow('w1', { page: 1, pageSize: 20 });
    expect(result.items).toEqual([]);
    expect(result.total).toBe(0);
  });

  it('should getById', async () => {
    mockPrisma.workflow_executions.findFirstOrThrow.mockResolvedValue({ id: 'e1' });
    const result = await service.getById('w1', 'e1');
    expect(result.id).toBe('e1');
  });
});
```

- [ ] **Step 5: Run tests**

Run: `cd apps/api && npx jest src/modules/workflow/execution.service.spec.ts --no-coverage`
Expected: 3 passed

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/modules/workflow/execution.service.ts apps/api/src/modules/workflow/dto/execute-workflow.dto.ts apps/api/src/modules/workflow/dto/pagination.dto.ts apps/api/src/modules/workflow/execution.service.spec.ts
git commit -m "feat: implement ExecutionService with execute/executeStream/list/getById"
```

---

### Task 3.2: Update Controller with run/executions/stream endpoints

**Files:**
- Modify: `apps/api/src/modules/workflow/workflow.controller.ts`

- [ ] **Step 1: Update controller**

```typescript
import {
  Controller, Get, Post, Body, Patch, Param, Delete, Query, Req, Res,
  ParseUUIDPipe, ParseIntPipe,
} from '@nestjs/common';
import { Response, Request } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { WorkflowService } from './workflow.service';
import { ExecutionService } from './execution.service';
import { CreateWorkflowDto } from './dto/create-workflow.dto';
import { UpdateWorkflowDto } from './dto/update-workflow.dto';
import { ExecuteWorkflowDto } from './dto/execute-workflow.dto';
import { PaginationDto } from './dto/pagination.dto';

@Controller('workflows')
export class WorkflowController {
  constructor(
    private readonly workflowService: WorkflowService,
    private readonly executionService: ExecutionService,
  ) {}

  @Post()
  create(@Body() createWorkflowDto: CreateWorkflowDto) {
    return this.workflowService.create(createWorkflowDto, 'system');
  }

  @Get()
  findAll() {
    return this.workflowService.findAll();
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.workflowService.findOne(id);
  }

  @Patch(':id')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() updateWorkflowDto: UpdateWorkflowDto) {
    return this.workflowService.update(id, updateWorkflowDto);
  }

  @Delete(':id')
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.workflowService.remove(id);
  }

  // ── 执行相关 ──

  @Post(':id/run')
  async run(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ExecuteWorkflowDto,
  ) {
    return this.executionService.execute(id, dto, 'system');
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

  // ── SSE 流式执行 ──

  @Post(':id/stream')
  async runStream(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ExecuteWorkflowDto,
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
      const stream = await this.executionService.executeStream(id, dto, 'system', executionId);
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
}
```

- [ ] **Step 2: Verify compilation**

Run: `cd apps/api && npx tsc --noEmit --pretty 2>&1 | head -30`
Expected: No errors related to workflow controller

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/modules/workflow/workflow.controller.ts
git commit -m "feat: add run/executions/stream SSE endpoints to controller"
```

---

### Task 3.3: Update WorkflowService CRUD with real Prisma queries

**Files:**
- Modify: `apps/api/src/modules/workflow/workflow.service.ts`

- [ ] **Step 1: Replace placeholder CRUD**

```typescript
import { Injectable } from '@nestjs/common';
import { PrismaService } from '@nexus/database';
import { CreateWorkflowDto } from './dto/create-workflow.dto';
import { UpdateWorkflowDto } from './dto/update-workflow.dto';

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

    if (dto.nodes?.length) {
      await this.syncGraphStructure(workflow.id, dto.nodes, dto.edges);
    }

    return workflow;
  }

  findAll() {
    return this.prisma.workflow.findMany({
      orderBy: { createdAt: 'desc' },
    });
  }

  findOne(id: string) {
    return this.prisma.workflow.findUniqueOrThrow({
      where: { id },
      include: {
        nodes: { orderBy: { positionY: 'asc' } },
        edges: true,
      },
    });
  }

  async update(id: string, dto: UpdateWorkflowDto) {
    const workflow = await this.prisma.workflow.update({
      where: { id },
      data: {
        name: dto.name,
        type: dto.type,
        description: dto.description,
        config: dto.config,
        isActive: dto.isActive,
      },
    });

    if (dto.nodes?.length) {
      await this.syncGraphStructure(workflow.id, dto.nodes, dto.edges);
    }

    return workflow;
  }

  remove(id: string) {
    return this.prisma.workflow.delete({ where: { id } });
  }

  private async syncGraphStructure(
    workflowId: string,
    nodes: any[],
    edges?: any[],
  ): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await tx.workflowEdge.deleteMany({ where: { workflowId } });
      await tx.workflowNode.deleteMany({ where: { workflowId } });

      await tx.workflowNode.createMany({
        data: nodes.map((n) => ({
          id: n.id,
          workflowId,
          type: n.type,
          label: n.label,
          positionX: n.positionX ?? 0,
          positionY: n.positionY ?? 0,
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

- [ ] **Step 2: Verify compilation**

Run: `cd apps/api && npx tsc --noEmit --pretty 2>&1 | head -30`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/modules/workflow/workflow.service.ts
git commit -m "feat: implement real Prisma CRUD in WorkflowService with graph sync"
```

---

### Task 3.4: Update CreateWorkflowDto with nodes/edges fields

**Files:**
- Modify: `apps/api/src/modules/workflow/dto/create-workflow.dto.ts`

- [ ] **Step 1: Update DTO**

```typescript
import {
  IsNotEmpty, IsString, IsObject, IsOptional, IsArray, IsNumber, IsUUID, ValidateNested, IsIn,
} from 'class-validator';
import { Type } from 'class-transformer';

export class WorkflowNodeInputDto {
  @IsUUID()
  id!: string;

  @IsIn(['start', 'end', 'retriever', 'llm', 'tool', 'condition', 'reflection', 'planner', 'solver', 'aggregator', 'code'])
  type!: string;

  @IsString()
  label!: string;

  @IsOptional()
  @IsNumber()
  positionX?: number;

  @IsOptional()
  @IsNumber()
  positionY?: number;

  @IsOptional()
  @IsObject()
  config?: Record<string, any>;
}

export class WorkflowEdgeInputDto {
  @IsUUID()
  sourceNodeId!: string;

  @IsUUID()
  targetNodeId!: string;

  @IsOptional()
  @IsString()
  sourceHandle?: string;

  @IsOptional()
  @IsString()
  targetHandle?: string;

  @IsOptional()
  @IsString()
  label?: string;

  @IsOptional()
  @IsObject()
  condition?: Record<string, any>;
}

export class CreateWorkflowDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsIn(['rag', 'reflection', 'rewoo', 'multi_agent', 'custom'])
  type!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsObject()
  config?: Record<string, any>;

  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => WorkflowNodeInputDto)
  nodes?: WorkflowNodeInputDto[];

  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => WorkflowEdgeInputDto)
  edges?: WorkflowEdgeInputDto[];
}
```

- [ ] **Step 2: Verify compilation**

Run: `cd apps/api && npx tsc --noEmit --pretty 2>&1 | head -30`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/modules/workflow/dto/create-workflow.dto.ts
git commit -m "feat: add nodes/edges with @ValidateNested to CreateWorkflowDto"
```

---

### Phase 4: Integration + SSE

---

### Task 4.1: Integration test — full workflow lifecycle

**Files:**
- Create: `apps/api/src/modules/workflow/workflow.integration.spec.ts`

- [ ] **Step 1: Write integration test**

```typescript
// apps/api/src/modules/workflow/workflow.integration.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { WorkflowModule } from './workflow.module';
import { PrismaService } from '@nexus/database';

describe('Workflow Integration (full lifecycle)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [WorkflowModule],
    })
      .overrideProvider(PrismaService)
      .useValue({
        workflow: {
          create: jest.fn().mockResolvedValue({ id: 'w1', name: 'test', type: 'rag', config: {} }),
          findUniqueOrThrow: jest.fn().mockResolvedValue({ id: 'w1', name: 'test', type: 'rag', config: {} }),
          findMany: jest.fn().mockResolvedValue([]),
          update: jest.fn().mockResolvedValue({ id: 'w1' }),
          delete: jest.fn().mockResolvedValue({ id: 'w1' }),
        },
        workflow_executions: {
          create: jest.fn().mockResolvedValue({ id: 'e1', workflowId: 'w1', status: 'RUNNING' }),
          update: jest.fn().mockResolvedValue({ id: 'e1' }),
          findMany: jest.fn().mockResolvedValue([]),
          findFirstOrThrow: jest.fn().mockResolvedValue({ id: 'e1' }),
          count: jest.fn().mockResolvedValue(0),
        },
      })
      .compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('POST /workflows should create a workflow', async () => {
    const res = await request(app.getHttpServer())
      .post('/workflows')
      .send({ name: 'test', type: 'rag', config: {} })
      .expect(201);
    expect(res.body.id).toBeDefined();
  });

  it('GET /workflows should list workflows', async () => {
    const res = await request(app.getHttpServer())
      .get('/workflows')
      .expect(200);
    expect(Array.isArray(res.body)).toBe(true);
  });
});
```

- [ ] **Step 2: Run integration test**

Run: `cd apps/api && npx jest src/modules/workflow/workflow.integration.spec.ts --no-coverage`
Expected: 2 passed (or skipped if supertest not available)

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/modules/workflow/workflow.integration.spec.ts
git commit -m "test: add workflow integration test for full lifecycle"
```

---

### Phase 5: V3 Designer prep (optional, skip for V2)

These tasks are from the design doc's Phase 5. They are **V3+** and can be skipped for the initial V2 implementation. They are listed here for reference only — do not implement them now.

- **Task 5.1**: CustomStrategy + compileGraph (V3+)
- **Task 5.2**: ConditionEvaluator (V3+)
- **Task 5.3**: DB nodes/edges → LangGraph StateGraph bidirectional mapping (V3+)
- **Task 5.4**: Vue Flow Designer (V3+)
- **Task 5.5**: LangGraph interrupt() + MemorySaver checkpointer (V4.5+)

---

## Self-Review Checklist

**1. Spec coverage:**
- ✅ Layer 1 (LangGraph Runtime): Task 1.1 (deps), Task 1.2 (AgentStateAnnotation)
- ✅ Layer 2 (Node Registry): Task 1.3 (NodeRegistry), Task 1.4 (6 nodes), Task 1.5 (module registration)
- ✅ Layer 3 (Strategy-Defined Graph): Task 2.1 (interface + factory), Task 2.2 (RagStrategy), Task 2.3 (ReflectionStrategy), Task 2.4 (stubs)
- ✅ Layer 4 (Execution Runtime): Task 3.1 (ExecutionService), Task 3.2 (Controller), Task 3.3 (WorkflowService), Task 3.4 (DTOs)
- ✅ Layer 5 (DeepAgents): Task 2.5 (npm verification), Task 2.4 (stubs with Plan B)
- ✅ SSE: Task 3.2 (runStream endpoint with @Res() + res.write())
- ✅ Two-mode compatibility: WorkflowService.syncGraphStructure() + StrategyFactory.getStrategy() separation
- ✅ node_steps batch write: ExecutionService STEP_BATCH_SIZE = 10

**2. Placeholder scan:**
- No TBD/TODO/fill-in-later patterns found
- Every code block contains complete, compilable code
- Test files have actual assertions, not stubs

**3. Type consistency:**
- `WorkflowType` = `'rag' | 'reflection' | 'rewoo' | 'multi_agent' | 'custom'` — consistent across all files
- `WorkflowNodeType` matches `WorkflowNodeType` enum in Prisma schema
- `NodeStepEvent` fields consistent between NodeRegistry, ExecutionService, and Controller
- `ExecutionResponse` matches `workflow_executions` Prisma model fields
- `OnStepCallback` type matches signature in NodeRegistry and ExecutionService

**4. ADR check:**
- ADR 1 (NodeRegistry in apps/api): ✅ Task 1.3 in apps/api
- ADR 2 (LangGraph in apps/api): ✅ Task 1.1 in apps/api
- ADR 3 (onStep callback): ✅ NodeRegistry.getNodeFn accepts onStep
- ADR 4 (StrategyFactory registry): ✅ Task 2.1
- ADR 5 (batch write): ✅ Task 3.1 STEP_BATCH_SIZE
- ADR 6 (client UUID): ✅ Task 3.3 syncGraphStructure uses client IDs
- ADR 7 (sync execution): ✅ Task 3.1 in-process execution
- ADR 8 (checkpointer): Task 5.5 (V4.5+)
- ADR 9 (Annotation API): ✅ Task 1.2
- ADR 10 (Plan B): ✅ Task 2.4 + 2.5