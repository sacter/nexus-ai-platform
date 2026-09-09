import { Prisma } from '@prisma/client';
import {
  Injectable,
  HttpException,
  NotImplementedException,
  BadRequestException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '@nexus/database';
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

  async execute(
    workflowId: string,
    input: ExecuteWorkflowDto,
    userId: string,
  ): Promise<ExecutionResponse> {
    const workflow = await this.prisma.workflow.findUniqueOrThrow({
      where: { id: workflowId },
    });

    await this.checkConcurrencyLimit(userId);

    const strategy = this.strategyFactory.getStrategy(
      workflow.type as WorkflowType,
    );
    const timeoutMs =
      (workflow.config as { timeoutMs?: number })?.timeoutMs ?? 300_000;
    const abortController = new AbortController();

    const execution = await this.prisma.workflowExecution.create({
      data: {
        workflowId,
        input: { ...input } as Prisma.InputJsonValue,
        status: 'RUNNING',
        startedAt: new Date(),
        createdBy: userId,
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
      workflow: {
        id: workflow.id,
        type: workflow.type as WorkflowType,
        config: workflow.config as any,
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

      for await (const _event of strategy.run(ctx)) {
        // 事件已在 onStep 中处理
      }
      clearTimeout(timeoutId);

      const duration = Date.now() - startTime;
      await this.persistNodeSteps(execution.id, nodeSteps);

      const result = await this.prisma.workflowExecution.update({
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

      await this.prisma.workflowExecution.update({
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
    const execution = await this.prisma.workflowExecution.findUniqueOrThrow({
      where: { id: executionId },
    });
    if (execution.status !== 'PAUSED' && execution.status !== 'WAITING') {
      throw new BadRequestException(`Cannot resume execution in status: ${execution.status}`);
    }
    throw new NotImplementedException('Resume is V3+');
  }

  private async persistNodeSteps(executionId: string, steps: NodeStep[]): Promise<void> {
    await this.prisma.workflowExecution.update({
      where: { id: executionId },
      data: { nodeSteps: steps as any },
    });
  }

  async listByWorkflow(workflowId: string, query: PaginationDto): Promise<{ items: any[]; total: number; page: number; pageSize: number }> {
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

    const strategy = this.strategyFactory.getStrategy(workflow.type as WorkflowType);
    const abortController = new AbortController();
    const timeoutMs = (workflow.config as any)?.timeoutMs ?? 300_000;

    await this.prisma.workflowExecution.create({
      data: { id: executionId, workflowId, input: input as any, status: 'RUNNING', startedAt: new Date(), createdBy: userId },
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
        await self.prisma.workflowExecution.update({
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
        await self.prisma.workflowExecution.update({
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
