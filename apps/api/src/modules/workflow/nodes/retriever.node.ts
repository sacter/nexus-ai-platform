import { Injectable } from '@nestjs/common';
import { RetrievalService } from '../../retrieval/retrieval.service';
import { Citation } from '../../retrieval/dto/search.dto';
import { NodeContext, GraphNode } from '../interface/node.interface';
import { AgentState } from '../interface/state.interface';

@Injectable()
export class RetrieverNode implements GraphNode {
  readonly type = 'retriever';
  readonly label = 'Retriever';

  constructor(private readonly retrievalService: RetrievalService) {}

  async execute(ctx: NodeContext): Promise<Partial<AgentState>> {
    const kbId = ctx.state.kbId ?? ctx.config?.configurable?.kbId;

    if (!kbId) {
      return { retrievedChunks: [], citations: [], error: 'No kbId provided' };
    }

    const query =
      (ctx.state.messages?.at(-1) as { content: string }).content || '';
    const topK =
      (ctx.config?.configurable as { topK?: number } | undefined)?.topK ?? 20;
    const { results } = await this.retrievalService.search({
      kbId,
      query,
      topK,
      strategy: 'hybrid',
    });

    const retrievedChunks: string[] = [];
    const citations: Citation[] = [];
    results.forEach(({ content, citation }) => {
      retrievedChunks.push(content);
      citations.push(citation);
    });

    return {
      retrievedChunks: retrievedChunks,
      citations: citations,
    };
  }
}
