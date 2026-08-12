import { EmbeddingProvider } from './embedding-provider.interface.js';

export interface OllamaEmbeddingConfig {
  baseUrl: string;
  model: string;
  dimension: number;
}

/**
 * Ollama 本地 Embedding Provider
 * POST /api/embed → { embeddings: number[][] }
 */
export class OllamaEmbeddingProvider implements EmbeddingProvider {
  readonly model: string;
  readonly dimension: number;
  private readonly baseUrl: string;

  constructor(config: OllamaEmbeddingConfig) {
    this.model = config.model;
    this.dimension = config.dimension;
    this.baseUrl = config.baseUrl.replace(/\/$/, '');
  }

  async embed(texts: string[]): Promise<number[][]> {
    const res = await fetch(`${this.baseUrl}/api/embed`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: this.model, input: texts }),
    });
    if (!res.ok) {
      throw new Error(`Ollama embed failed: HTTP ${res.status}`);
    }
    const data = (await res.json()) as { embeddings: number[][] };
    return data.embeddings;
  }
}
