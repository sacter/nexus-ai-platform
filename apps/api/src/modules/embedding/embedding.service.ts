import { Injectable, Logger } from '@nestjs/common';
import { createHash } from 'crypto';
import { ModelProviderService } from '../model-provider/model-provider.service';
import { RedisService } from '../../infrastructure/redis/redis.service';
import { OllamaEmbeddingProvider } from './providers/ollama-embedding.provider';
import { OpenAiEmbeddingProvider } from './providers/openai-embedding.provider';
import { BatchEmbedder } from '../../worker/pipelines/embedders/batch-embedder';

export interface QueryEmbedResult {
  vector: number[];
  model: string;
  dimension: number;
  cached: boolean;
}

/** Embedding 缓存 TTL：24h（设计文档 2bis.3） */
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
          });
    return { config, provider };
  }

  /**
   * 批量向量化（文档 chunks 索引用）
   */
  async embedChunks(texts: string[], modelName?: string): Promise<number[][]> {
    const { config, provider } = this.buildProvider(modelName);
    return new BatchEmbedder(provider).embed(texts);
  }

  /**
   * ★ 客户提问 Embedding + 缓存流程（功能6）
   *
   * 1. hash = SHA256(query)
   * 2. key = embed:{hash}:{model_name}
   * 3. Redis GET → HIT 直接返回；MISS → 调 provider → SETEX 24h
   */
  async embedQuery(query: string, opts?: { modelName?: string }): Promise<QueryEmbedResult> {
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
