import { Injectable, Logger } from '@nestjs/common';
import { Reranker, RerankInput, RerankOutput } from './reranker.interface';

interface BgeRerankerConfig {
  baseUrl: string;
  apiKey?: string;
  model: string;
}

// ★ cross-encoder 只需看前 ~512 token 即可判断相关性，发送前截断长文档
//   可显著降低本地 CPU 推理耗时（长 chunk 推理时间近乎线性增长）
const MAX_RERANK_CHARS = 512;

@Injectable()
export class BgeRerankerService implements Reranker {
  readonly name = 'bge-reranker';
  private readonly logger = new Logger(BgeRerankerService.name);

  private readonly config: BgeRerankerConfig = {
    baseUrl: process.env.BGE_RERANKER_BASE_URL ?? 'http://localhost:8080',
    // ★ Infinity 按精确 model id 路由，必须用完整 ID（短名会返回 400）
    model: process.env.BGE_RERANKER_MODEL ?? 'BAAI/bge-reranker-base',
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
          // 仅截断发送给模型的文本；results[].index 仍映射原始 input.documents
          documents: input.documents.map((d) =>
            d.content.slice(0, MAX_RERANK_CHARS),
          ),
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
