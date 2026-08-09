import { Injectable, Logger } from '@nestjs/common';
import { Reranker, RerankInput, RerankOutput } from './reranker.interface';

interface BgeRerankerConfig {
  baseUrl: string;
  apiKey?: string;
  model: string;
}

@Injectable()
export class BgeRerankerService implements Reranker {
  readonly name = 'bge-reranker';
  private readonly logger = new Logger(BgeRerankerService.name);

  private readonly config: BgeRerankerConfig = {
    baseUrl: process.env.BGE_RERANKER_BASE_URL ?? 'http://localhost:8080',
    model: process.env.BGE_RERANKER_MODEL ?? 'bge-reranker-v2-m3',
  };

  async rerank(input: RerankInput, topK = 5): Promise<RerankOutput[]> {
    const url = `${this.config.baseUrl}/rerank`;

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(this.config.apiKey
            ? { Authorization: `Bearer ${this.config.apiKey}` }
            : {}),
        },
        body: JSON.stringify({
          query: input.query,
          documents: input.documents.map((d) => d.content),
          model: this.config.model,
          top_k: topK,
        }),
      });

      if (!response.ok) {
        this.logger.warn(
          `BGE Reranker 返回 HTTP ${response.status}，跳过重排序`,
        );
        return [];
      }

      const data = (await response.json()) as {
        results: { index: number; relevance_score: number }[];
      };

      return data.results.map((r) => ({
        chunkId: input.documents[r.index].chunkId,
        relevanceScore: r.relevance_score,
      }));
    } catch (error) {
      this.logger.warn('BGE Reranker 调用失败，跳过重排序', error);
      return [];
    }
  }
}
