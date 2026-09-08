import { Injectable } from '@nestjs/common';
import { StateGraph, START, END } from '@langchain/langgraph';
import { HumanMessage, AIMessage } from '@langchain/core/messages';
import { NodeRegistry } from '../node-registry';
import { NodeStepEvent } from '../interface/node.interface';
import { AgentStateAnnotation } from '../state';
import {
  WorkflowStrategy,
  WorkflowExecutionContext,
} from '../interface/workflow-strategy.interface';
import { WorkflowNodeType } from '../interface/workflow.interface';

@Injectable()
export class RagStrategy implements WorkflowStrategy {
  readonly type = 'rag';

  constructor(private readonly registry: NodeRegistry) {}

  async *run(ctx: WorkflowExecutionContext): AsyncGenerator<NodeStepEvent> {
    const config = ctx.workflow.config;
    const { question, chatHistory, kbIds, modelId } = ctx.input;

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

    const graph = new StateGraph(AgentStateAnnotation)
      .addNode('retriever', retrieverNode)
      .addNode('llm', llmNode)
      .addEdge(START, 'retriever')
      .addEdge('retriever', 'llm')
      .addEdge('llm', END)
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
            nodeType: this.resolveNodeType(nodeName),
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

  private resolveNodeType(nodeName: string): WorkflowNodeType {
    const map: Record<string, WorkflowNodeType> = {
      retriever: 'retriever',
      llm: 'llm',
      judge: 'reflection',
      planner: 'planner',
      solver: 'solver',
      aggregator: 'aggregator',
    };
    return map[nodeName] ?? 'llm';
  }
}
