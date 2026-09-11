import { Injectable } from '@nestjs/common';
import { StateGraph, START, END } from '@langchain/langgraph';
import { HumanMessage, AIMessage } from '@langchain/core/messages';
import { NodeRegistry } from '../node-registry';
import { AgentStateAnnotation } from '../state';
import { resolveNodeType } from '../utils/node-type.util';
import { NodeStepEvent } from '../interface/node.interface';
import { AgentState } from '../interface/state.interface';
import {
  WorkflowStrategy,
  WorkflowExecutionContext,
} from '../interface/workflow-strategy.interface';

@Injectable()
export class RewooStrategy implements WorkflowStrategy {
  readonly type = 'rewoo';

  constructor(private readonly registry: NodeRegistry) {}

  async *run(ctx: WorkflowExecutionContext): AsyncGenerator<NodeStepEvent> {
    const config = ctx.workflow.config;
    const { question, chatHistory, kbIds, modelId } = ctx.input;

    const maxIterations = (ctx.workflow.config.maxIterations ?? 3) as number;

    const retrieverNode = this.registry.getNodeFn(
      'retriever',
      {
        kbId: kbIds?.[0],
        topK: (config.retriever as { topK: number })?.topK ?? 20,
      },
      ctx.onStep,
    );

    const llmNode = this.registry.getNodeFn(
      'llm',
      {
        modelId: modelId ?? (config.llm as { modelId: string })?.modelId,
        temperature:
          (config.llm as { temperature: number })?.temperature ?? 0.7,
      },
      ctx.onStep,
    );

    const routerNode = this.registry.getNodeFn(
      'router',
      {
        kbId: kbIds?.[0],
        modelId: modelId ?? (config.llm as { modelId: string })?.modelId,
      },
      ctx.onStep,
    );

    const judgeNode = this.registry.getNodeFn(
      'reflection',
      {
        modelId: modelId ?? (config.llm as { modelId: string })?.modelId,
      },
      ctx.onStep,
    );

    // 循环图: router → retriever 或 直接到llm → llm → judge(condition) → retriever 或 END
    const graph = new StateGraph(AgentStateAnnotation)
      .addNode('router', routerNode)
      .addNode('retriever', retrieverNode)
      .addNode('llm', llmNode)
      .addNode('judge', judgeNode)
      .addEdge(START, 'router')
      .addConditionalEdges('router', (state: AgentState) =>
        state.routerDecision === 'retrieve' ? 'retriever' : 'llm',
      )
      .addEdge('retriever', 'llm')
      .addEdge('llm', 'judge')
      .addConditionalEdges('judge', (state: AgentState) => {
        const iteration = state.iteration ?? 0;
        if (state.needsImprovement && iteration < maxIterations) {
          return 'retriever';
        }
        return END;
      })
      .compile();

    const input = {
      messages: [
        ...(chatHistory ?? []).map((m) =>
          m.role === 'user'
            ? new HumanMessage(m.content)
            : new AIMessage(m.content),
        ),
        new HumanMessage(question),
      ],
      kbId: kbIds?.[0],
      modelId: modelId ?? (config.llm as { modelId: string })?.modelId,
    };

    try {
      const stream = await graph.stream(input, {
        configurable: {
          workflowId: ctx.workflow.id,
          executionId: ctx.executionId,
        },
        signal: ctx.signal,
      });
      for await (const event of stream) {
        for (const [nodeName, output] of Object.entries(event)) {
          yield {
            nodeId: nodeName,
            nodeType: resolveNodeType(nodeName),
            status: (output as { error: string })?.error
              ? 'failed'
              : 'completed',
            input: { question },
            output: output,
            durationMs: 0,
            startedAt: new Date().toISOString(),
            completedAt: new Date().toISOString(),
          };
        }
      }
    } catch (err: unknown) {
      yield {
        nodeId: 'graph',
        nodeType: 'end',
        status: 'failed',
        errorMessage: (err as Error).message,
        startedAt: new Date().toISOString(),
        completedAt: new Date().toISOString(),
      };
      throw err;
    }
  }
}
