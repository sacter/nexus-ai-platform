import { EmbeddingProvider } from './providers/embedding-provider.interface';

/**
 * 批量向量化器 —— 控制 Provider 的批大小与并发
 * 每批 BATCH_SIZE 条，串行调用 provider（避免触发 rate limit）
 */
export class BatchEmbedder {
  private static readonly BATCH_SIZE = 32;

  constructor(private readonly provider: EmbeddingProvider) {}

  async embed(texts: string[]): Promise<number[][]> {
    const results: number[][] = [];
    for (let i = 0; i < texts.length; i += BatchEmbedder.BATCH_SIZE) {
      const batch = texts.slice(i, i + BatchEmbedder.BATCH_SIZE);
      const vectors = await this.provider.embed(batch);
      results.push(...vectors);
    }
    return results;
  }
}
