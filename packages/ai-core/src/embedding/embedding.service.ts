import { Injectable, Logger } from '@nestjs/common';
import { createHash } from 'crypto';
import { ModelProviderService } from '../model-provider/model-provider.service.js';
import { EmbeddingModelConfig } from '../model-provider/model-provider.js';
import { RedisService } from '@nexus/shared';
import { EmbeddingProvider } from './providers/embedding-provider.interface.js';
import { OllamaEmbeddingProvider } from './providers/ollama-embedding.provider.js';
import { OpenAiEmbeddingProvider } from './providers/openai-embedding.provider.js';
import { BatchEmbedder } from './batch-embedder.js';

export interface QueryEmbedResult {
  vector: number[];
  model: string;
  dimension: number;
  cached: boolean;
}

/** Embedding 缓存 TTL：24h */
const EMBEDDING_CACHE_TTL = 60 * 60 * 24;

@Injectable()
export class EmbeddingService {
  private readonly logger = new Logger(EmbeddingService.name);

  constructor(
    private readonly modelProvider: ModelProviderService,
    private readonly redis: RedisService,
  ) {}

  private buildProvider(modelName?: string) {
    const config = this.modelProvider.resolveEmbeddingConfig(modelName);
    const provider =
      config.provider === 'openai'
        ? new OpenAiEmbeddingProvider({
            baseUrl: config.baseUrl,
            apiKey: config.apiKey ?? '',
            model: config.model,
            dimension: config.dimension,
          })
        : new OllamaEmbeddingProvider({
            baseUrl: config.baseUrl,
            model: config.model,
            dimension: config.dimension,
            // 模型常驻时长可用 OLLAMA_KEEP_ALIVE 覆盖（如 '-1' 永久驻留）
            keepAlive: process.env.OLLAMA_KEEP_ALIVE,
          });
    return { config, provider };
  }

  /**
   * 批量向量化（文档 chunks 索引用）
   */
  async embedChunks(texts: string[], modelName?: string): Promise<number[][]> {
    const { provider } = this.buildProvider(modelName);
    return new BatchEmbedder(provider).embed(texts);
  }

  /** 进程内 in-flight 去重：相同 key 的并发 embedQuery 只发一次 provider 请求 */
  private readonly inflight = new Map<string, Promise<QueryEmbedResult>>();

  /**
   * ★ 客户提问 Embedding + 缓存流程
   *
   * 1. hash = SHA256(query)
   * 2. key = embed:{hash}:{model_name}
   * 3. Redis GET → HIT 直接返回；MISS → 调 provider → SETEX 24h
   * 4. 并发 MISS 由 in-flight 去重兜底，避免重复冷加载/重复计费
   */
  async embedQuery(
    query: string,
    opts?: { modelName?: string },
  ): Promise<QueryEmbedResult> {
    const { config, provider } = this.buildProvider(opts?.modelName);
    const hash = createHash('sha256').update(query).digest('hex');
    const key = `embed:${hash}:${config.model}`;

    const cached = await this.redis.get(key);
    if (cached) {
      return {
        vector: JSON.parse(cached) as number[],
        model: config.model,
        dimension: config.dimension,
        cached: true,
      };
    }

    // 单飞：并发相同 query 时共享同一次 provider 调用
    const pending = this.inflight.get(key);
    if (pending) {
      return pending;
    }
    const promise = this.embedAndCache(provider, config, key, query);
    this.inflight.set(key, promise);
    try {
      return await promise;
    } finally {
      this.inflight.delete(key);
    }
  }

  private async embedAndCache(
    provider: EmbeddingProvider,
    config: EmbeddingModelConfig,
    key: string,
    query: string,
  ): Promise<QueryEmbedResult> {
    const [vector] = await provider.embed([query]);
    await this.redis.set(key, JSON.stringify(vector), EMBEDDING_CACHE_TTL);
    return {
      vector,
      model: config.model,
      dimension: config.dimension,
      cached: false,
    };
  }
}
