import { EmbeddingProvider } from './embedding-provider.interface.js';

export interface OpenAiEmbeddingConfig {
  baseUrl: string;
  apiKey: string;
  model: string;
  dimension: number;
}

/**
 * OpenAI 兼容 Embedding Provider（OpenAI / DashScope / 各类中转）
 * POST {baseUrl}/embeddings → { data: [{ embedding }] }
 */
export class OpenAiEmbeddingProvider implements EmbeddingProvider {
  readonly model: string;
  readonly dimension: number;
  private readonly baseUrl: string;
  private readonly apiKey: string;

  constructor(config: OpenAiEmbeddingConfig) {
    this.model = config.model;
    this.dimension = config.dimension;
    this.baseUrl = config.baseUrl.replace(/\/+$/, '');
    this.apiKey = config.apiKey;
  }

  async embed(texts: string[]): Promise<number[][]> {
    const res = await fetch(`${this.baseUrl}/embeddings`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({ model: this.model, input: texts }),
    });
    if (!res.ok) {
      throw new Error(`OpenAI embed failed: HTTP ${res.status}`);
    }
    const data = (await res.json()) as { data: Array<{ embedding: number[] }> };
    return data.data.map((d) => d.embedding);
  }
}
