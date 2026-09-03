import { Module, OnModuleInit } from '@nestjs/common';
import { WorkflowService } from './workflow.service';
import { WorkflowController } from './workflow.controller';
import { ExecutionService } from './execution.service';
import { NodeRegistry } from './node-registry';
// 节点类
import { StartNode } from './nodes/start.node';
import { EndNode } from './nodes/end.node';
import { RetrieverNode } from './nodes/retriever.node';
import { LlmNode } from './nodes/llm.node';
import { ConditionNode } from './nodes/condition.node';
import { ReflectionNode } from './nodes/reflection.node';
// 策略工厂
import { WorkflowStrategyFactory } from './strategies/workflow-strategy.factory';
import { RagStrategy } from './strategies/rag.strategy';
import { ReflectionStrategy } from './strategies/reflection.strategy';
import { RewooStrategy } from './strategies/rewoo.strategy';
import { MultiAgentStrategy } from './strategies/multi-agent.strategy';
// 模块
import { RetrievalModule } from '../retrieval/retrieval.module';
import { ModelModule } from '../model/model.module';

@Module({
  imports: [RetrievalModule, ModelModule],
  controllers: [WorkflowController],
  providers: [
    WorkflowService,
    ExecutionService,
    NodeRegistry,
    WorkflowStrategyFactory,

    // 内置节点
    StartNode,
    EndNode,
    ConditionNode,
    RetrieverNode,
    LlmNode,
    ReflectionNode,

    // 策略
    RagStrategy,
    ReflectionStrategy,
    RewooStrategy,
    MultiAgentStrategy,
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
    private readonly workflowStrategyFactory: WorkflowStrategyFactory,
    private readonly ragStrategy: RagStrategy,
    private readonly reflectionStrategy: ReflectionStrategy,
    private readonly rewooStrategy: RewooStrategy,
    private readonly multiAgentStrategy: MultiAgentStrategy,
  ) {}

  onModuleInit() {
    // 注册节点
    this.registry.register('start', () => this.startNode);
    this.registry.register('end', () => this.endNode);
    this.registry.register('condition', () => this.conditionNode);
    this.registry.register('retriever', () => this.retrieverNode);
    this.registry.register('llm', () => this.llmNode);
    this.registry.register('reflection', () => this.reflectionNode);

    // 注册策略
    this.workflowStrategyFactory.register(this.ragStrategy);
    this.workflowStrategyFactory.register(this.reflectionStrategy);
    this.workflowStrategyFactory.register(this.multiAgentStrategy);
    this.workflowStrategyFactory.register(this.rewooStrategy);
  }
}
