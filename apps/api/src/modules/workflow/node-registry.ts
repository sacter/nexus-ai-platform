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
  input?: Record<string, unknown>;
  output?: Record<string, unknown>;
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

type GraphNodeFactory = (config?: Record<string, unknown>) => GraphNode;
type LangGraphNodeFn = (
  state: AgentState,
  config?: RunnableConfig,
) => Promise<Partial<AgentState>>;

@Injectable()
export class NodeRegistry {
  private factories = new Map<string, GraphNodeFactory>();
  private instances = new Map<string, GraphNode>();

  /**
   * 利用工厂函数注册节点类型。
   * @param type 节点类型
   * @param factory 工厂函数
   */
  register(type: string, factory: GraphNodeFactory): void {
    if (this.factories.has(type)) {
      throw new Error(`Node type "${type}" already registered`);
    }
    this.factories.set(type, factory);
  }

  /**
   * 获取一个节点函数，用于执行节点。
   * @param type 节点类型
   * @param config 节点配置
   * @param onStep 步骤回调函数
   * @returns 节点函数
   */
  getNodeFn(
    type: string,
    config?: Record<string, any>,
    onStep?: OnStepCallback,
  ): LangGraphNodeFn {
    const node = this.resolve(type, config);

    return async (state: AgentState, runtimeConfig?: RunnableConfig) => {
      const { nodeId, workflowId, executionId } =
        runtimeConfig?.configurable ?? {};
      const ctx: NodeContext = {
        state,
        config: runtimeConfig ?? {},
        metadata: {
          nodeId: (nodeId as string) ?? type,
          nodeType: type,
          workflowId: (workflowId as string) || '',
          executionId: (executionId as string) || '',
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
          input: {/* 由节点自行填充 */},
          output: result,
          durationMs,
          startedAt: new Date(startTime).toISOString(),
          completedAt: new Date().toISOString(),
        });

        return result;
      } catch (err: unknown) {
        const durationMs = Date.now() - startTime;
        let errorMessage: string;
        if (err instanceof Error) {
          errorMessage = err.message;
        } else {
          errorMessage = String(err);
        }
        await ctx.onStep({
          nodeId: ctx.metadata.nodeId,
          nodeType: type,
          status: 'failed',
          errorMessage,
          durationMs,
          startedAt: new Date(startTime).toISOString(),
          completedAt: new Date().toISOString(),
        });
        return { error: `${type} node failed: ${errorMessage}` };
      }
    };
  }

  /**
   * 根据给定的类型和配置解析节点实例。
   * @param type 节点类型
   * @param config 节点配置
   * @returns 节点实例
   */
  private resolve(type: string, config?: Record<string, unknown>): GraphNode {
    const factory = this.factories.get(type);
    if (!factory) throw new Error(`Unknown node type: ${type}`);
    const key = `${type}:${JSON.stringify(config ?? {})}`;
    if (!this.instances.has(key)) {
      this.instances.set(key, factory(config ?? {}));
    }
    return this.instances.get(key)!;
  }
}
