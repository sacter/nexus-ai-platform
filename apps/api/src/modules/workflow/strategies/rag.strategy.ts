import { Injectable } from '@nestjs/common';
// import { StateGraph, START, END } from '@langchain/langgraph';
// import { HumanMessage, AIMessage } from '@langchain/core/messages';
// import { NodeRegistry, NodeStepEvent } from '../node-registry';
// import { AgentStateAnnotation } from '../state';
import { WorkflowStrategy } from '../interface/workflow-strategy.interface';

@Injectable()
export class RagStrategy implements WorkflowStrategy {
  readonly type = 'rag';

  async *run() {
    /// todo
  }
}
