import {
  Injectable,
  HttpException,
  NotImplementedException,
  BadRequestException,
} from '@nestjs/common';
import type { WorkflowExecution } from '@prisma/client';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '@nexus/database';
import { instanceToPlain } from 'class-transformer';
import { WorkflowStrategyFactory } from './strategies/workflow-strategy.factory';
import { ExecuteWorkflowDto } from './dto/execute-workflow.dto';
import { PaginationDto } from './dto/pagination.dto';
import { WorkflowExecutionContext } from './interface/workflow-strategy.interface';
import { NodeStepEvent } from './interface/node.interface';
import {
  WorkflowType,
  ExecutionResponse,
  NodeStep,
} from './interface/workflow.interface';

@Injectable()
export class ExecutionService {
  // 每 10 步批量写一次 DB
  private static readonly STEP_BATCH_SIZE = 10;
  private static readonly MAX_CONCURRENT_PER_USER = 5;

  constructor(
    private readonly strategyFactory: WorkflowStrategyFactory,
    private readonly prisma: PrismaService,
    private readonly eventEmitter: EventEmitter2,
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

    const strategy = this.strategyFactory.getStrategy(
      workflow.type as WorkflowType,
    );
    const timeoutMs =
      (workflow.config as { timeoutMs?: number })?.timeoutMs ?? 300_000;
    const abortController = new AbortController();

    // 创建执行记录
    const execution = await this.prisma.workflowExecution.create({
      data: {
        workflowId,
        input: instanceToPlain(input),
        status: 'RUNNING',
        startedAt: new Date(),
        createdBy: userId,
      },
    });

    // onStep 回调：内存累积 + 事件发射
    const nodeSteps: NodeStep[] = [];
    const onStep = async (event: NodeStepEvent) => {
      nodeSteps.push(event);
      this.eventEmitter.emit('workflow.step', {
        executionId: execution.id,
        event,
      });
      // 批量写入：每 STEP_BATCH_SIZE 步写一次
      if (nodeSteps.length % ExecutionService.STEP_BATCH_SIZE === 0) {
        await this.persistNodeSteps(execution.id, nodeSteps);
      }
    };

    const ctx: WorkflowExecutionContext = {
      workflow: {
        id: workflow.id,
        type: workflow.type as WorkflowType,
        config: workflow.config as Record<string, unknown>,
      },
      executionId: execution.id,
      input: {
        question: input.question,
        chatHistory: input.chatHistory,
        kbIds: input.kbIds,
      },
      onStep,
      signal: abortController.signal,
      timeoutMs,
    };

    const startTime = Date.now();

    try {
      const timeoutId = setTimeout(() => abortController.abort(), timeoutMs);

      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      for await (const _event of strategy.run(ctx)) {
        // 事件已在 onStep 中处理（内存累积 + 批量写 DB）
        // 此处仅做 SSE 推送（由 Controller 通过 Observable 处理）
      }
      clearTimeout(timeoutId);

      const duration = Date.now() - startTime;

      // 最终写入剩余 node_steps
      await this.persistNodeSteps(execution.id, nodeSteps);

      const result = await this.prisma.workflowExecution.update({
        where: { id: execution.id },
        data: {
          status: 'COMPLETED',
          output: {
            answer: this.extractAnswer(nodeSteps),
            citations: this.extractCitations(nodeSteps),
          },
          durationMs: duration,
          nodeSteps: instanceToPlain(nodeSteps),
          completedAt: new Date(),
        },
      });

      // 审计日志（不阻塞）
      this.recordAudit(workflowId).catch(() => {});

      return this.toResponse(result);
    } catch (err: unknown) {
      const duration = Date.now() - startTime;

      // 确保失败时也写入累积的 node_steps
      await this.persistNodeSteps(execution.id, nodeSteps);

      let status: 'CANCELLED' | 'FAILED' = 'FAILED';
      let errorMessage = 'Unknown error';

      if (err instanceof Error) {
        if (err.name === 'AbortError') {
          status = 'CANCELLED';
          errorMessage = 'Execution timeout or cancelled';
        } else {
          errorMessage = err.message;
        }
      } else {
        errorMessage = String(err);
      }

      await this.prisma.workflowExecution.update({
        where: { id: execution.id },
        data: {
          status: status,
          errorMessage: errorMessage,
          durationMs: duration,
          nodeSteps: instanceToPlain(nodeSteps),
          completedAt: new Date(),
        },
      });

      throw err;
    }
  }

  /** 断点恢复（V3+ Human-in-the-loop 预留，使用 LangGraph 原生 checkpointer） */
  async resume(executionId: string): Promise<ExecutionResponse> {
    const execution = await this.prisma.workflowExecution.findUniqueOrThrow({
      where: { id: executionId },
    });
    if (execution.status !== 'PAUSED' && execution.status !== 'WAITING') {
      throw new BadRequestException(
        `Cannot resume execution in status: ${execution.status}`,
      );
    }
    // V3: 使用 LangGraph 的 MemorySaver checkpointer 恢复
    // graph.stream(null, { configurable: { thread_id: executionId } })
    throw new NotImplementedException('Resume is V3+');
  }

  /** 持久化 node_steps */
  private async persistNodeSteps(
    executionId: string,
    steps: NodeStep[],
  ): Promise<void> {
    await this.prisma.workflowExecution.update({
      where: { id: executionId },
      data: { nodeSteps: instanceToPlain(steps) },
    });
  }

  /** 查询某个 Workflow 的所有执行记录 */
  async listByWorkflow(
    workflowId: string,
    query: PaginationDto,
  ): Promise<{ items: any[]; total: number; page: number; pageSize: number }> {
    const [items, total] = await Promise.all([
      this.prisma.workflowExecution.findMany({
        where: { workflowId },
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.workflowExecution.count({ where: { workflowId } }),
    ]);
    return { items, total, page: query.page, pageSize: query.pageSize };
  }

  /** 查询单条执行详情 */
  async getById(workflowId: string, execId: string): Promise<any> {
    return this.prisma.workflowExecution.findFirstOrThrow({
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

    const strategy = this.strategyFactory.getStrategy(
      workflow.type as WorkflowType,
    );
    const abortController = new AbortController();
    const timeoutMs =
      (workflow.config as { timeoutMs?: number })?.timeoutMs ?? 300_000;

    await this.prisma.workflowExecution.create({
      data: {
        id: executionId,
        workflowId,
        input: instanceToPlain(input),
        status: 'RUNNING',
        startedAt: new Date(),
        createdBy: userId,
      },
    });

    const nodeSteps: NodeStep[] = [];
    const onStep = async (event: NodeStepEvent) => {
      nodeSteps.push(event);
      if (nodeSteps.length % ExecutionService.STEP_BATCH_SIZE === 0) {
        await this.persistNodeSteps(executionId, nodeSteps);
      }
    };

    const ctx: WorkflowExecutionContext = {
      workflow: {
        id: workflow.id,
        type: workflow.type as WorkflowType,
        config: workflow.config as Record<string, unknown>,
      },
      executionId,
      input: {
        question: input.question,
        chatHistory: input.chatHistory,
        kbIds: input.kbIds,
      },
      onStep,
      signal: abortController.signal,
      timeoutMs,
    };

    // eslint-disable-next-line @typescript-eslint/no-this-alias
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
        await self.prisma.workflowExecution.update({
          where: { id: executionId },
          data: {
            status: 'COMPLETED',
            output: {
              answer: self.extractAnswer(nodeSteps),
              citations: self.extractCitations(nodeSteps),
            },
            durationMs: duration,
            nodeSteps: instanceToPlain(nodeSteps),
            completedAt: new Date(),
          },
        });
      } catch (err: any) {
        clearTimeout(timeoutId);
        const duration = Date.now() - startTime;
        await self.persistNodeSteps(executionId, nodeSteps);

        let status: 'CANCELLED' | 'FAILED' = 'FAILED';
        let errorMessage = 'Unknown error';
        if (err instanceof Error) {
          if (err.name === 'AbortError') {
            status = 'CANCELLED';
            errorMessage = 'Execution timeout or cancelled';
          } else {
            errorMessage = err.message;
          }
        } else {
          errorMessage = String(err);
        }
        await self.prisma.workflowExecution.update({
          where: { id: executionId },
          data: {
            status: status,
            errorMessage: errorMessage,
            durationMs: duration,
            nodeSteps: instanceToPlain(nodeSteps),
            completedAt: new Date(),
          },
        });
        throw err;
      }
    })();
  }

  /** 并发限制 */
  private async checkConcurrencyLimit(userId: string): Promise<void> {
    // 按用户限制并发执行数（依赖 created_by 字段）
    const count = await this.prisma.workflowExecution.count({
      where: { status: 'RUNNING', createdBy: userId },
    });
    if (count >= ExecutionService.MAX_CONCURRENT_PER_USER) {
      throw new HttpException(
        `Too many concurrent executions (max ${ExecutionService.MAX_CONCURRENT_PER_USER} per user)`,
        429,
      );
    }
  }

  // eslint-disable-next-line @typescript-eslint/require-await
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
    const llmSteps = steps.filter(
      (s) => s.nodeType === 'llm' && s.status === 'completed',
    );
    const last = llmSteps[llmSteps.length - 1];
    return (
      (last?.output as { messages?: { content: string }[] })?.messages?.[0]
        ?.content ?? ''
    );
  }

  private extractCitations(steps: NodeStep[]): any[] {
    const retrieverSteps = steps.filter(
      (s) => s.nodeType === 'retriever' && s.status === 'completed',
    );
    const last = retrieverSteps[retrieverSteps.length - 1];
    return (last?.output as { citations?: unknown[] })?.citations ?? [];
  }

  private toResponse(result: WorkflowExecution): ExecutionResponse {
    return {
      id: result.id,
      workflowId: result.workflowId ?? '',
      status: result.status,
      input: result.input,
      output: result.output ?? undefined,
      durationMs: result.durationMs ?? undefined,
      errorMessage: result.errorMessage ?? undefined,
      nodeSteps: (result.nodeSteps as unknown as NodeStepEvent[]) ?? [],
      startedAt: result.startedAt?.toISOString() ?? undefined,
      completedAt: result.completedAt?.toISOString() ?? undefined,
      createdAt: result.createdAt.toISOString(),
    };
  }
}
