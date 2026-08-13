import { EmbeddingProvider } from './embedding-provider.interface.js';

export interface OllamaEmbeddingConfig {
  baseUrl: string;
  model: string;
  dimension: number;
  /** 模型常驻内存时长（Ollama keep_alive），避免冷加载耗时，如 '30m'、'-1'（永久） */
  keepAlive?: string;
}

/**
 * Ollama 本地 Embedding Provider
 * POST /api/embed → { embeddings: number[][] }
 */
export class OllamaEmbeddingProvider implements EmbeddingProvider {
  readonly model: string;
  readonly dimension: number;
  private readonly baseUrl: string;
  private readonly keepAlive: string;

  constructor(config: OllamaEmbeddingConfig) {
    this.model = config.model;
    this.dimension = config.dimension;
    this.baseUrl = config.baseUrl.replace(/\/$/, '');
    this.keepAlive = config.keepAlive ?? '30m';
  }

  async embed(texts: string[]): Promise<number[][]> {
    const res = await fetch(`${this.baseUrl}/api/embed`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      // 超时保护：Ollama 挂起/冷加载异常时避免请求无限等待
      signal: AbortSignal.timeout(30_000),
      body: JSON.stringify({
        model: this.model,
        input: texts,
        // 显式延长模型驻留，避免默认 5min 后卸载导致下次请求冷加载 ~5s
        keep_alive: this.keepAlive,
      }),
    });
    if (!res.ok) {
      throw new Error(`Ollama embed failed: HTTP ${res.status}`);
    }
    const data = (await res.json()) as { embeddings: number[][] };
    return data.embeddings;
  }
}
