import { Injectable, Logger } from '@nestjs/common';
import { Reranker, RerankInput, RerankOutput } from './reranker.interface';

@Injectable()
export class CohereRerankerService implements Reranker {
  readonly name = 'cohere-rerank';
  private readonly logger = new Logger(CohereRerankerService.name);

  private readonly config = {
    apiKey: process.env.COHERE_API_KEY ?? '',
    baseUrl: process.env.COHERE_BASE_URL ?? 'https://api.cohere.com/v1',
    model: process.env.COHERE_RERANK_MODEL ?? 'rerank-english-v3.0',
  };

  async rerank(input: RerankInput, topK = 5): Promise<RerankOutput[]> {
    if (!this.config.apiKey) {
      this.logger.warn('Cohere API key not configured, skipping rerank');
      return [];
    }

    const url = `${this.config.baseUrl}/rerank`;

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.config.apiKey}`,
        },
        body: JSON.stringify({
          model: this.config.model,
          query: input.query,
          documents: input.documents.map((d) => d.content),
          top_n: topK,
        }),
      });

      if (!response.ok) {
        this.logger.warn(
          `Cohere Rerank returned ${response.status}, skipping rerank`,
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
      this.logger.warn('Cohere Rerank call failed, skipping rerank', error);
      return [];
    }
  }
}
