import { Injectable } from '@nestjs/common';
import {
  EmbeddingModelConfig,
  isEmbeddingProviderName,
  parseModelName,
  resolveKnownModel,
} from './model-provider.js';

/**
 * 模型提供解析服务
 *
 * 解析优先级：传入 modelName（KB.embedding_model）→ 环境默认
 * provider baseUrl/apiKey 从环境变量读取。
 */
@Injectable()
export class ModelProviderService {
  resolveEmbeddingConfig(modelName?: string): EmbeddingModelConfig {
    const effectiveModel =
      modelName?.trim() || process.env.EMBEDDING_DEFAULT_MODEL || 'bge-m3';
    const { provider: providerHint, name } = parseModelName(effectiveModel);
    const known = resolveKnownModel(name);

    const envProvider = isEmbeddingProviderName(
      process.env.EMBEDDING_DEFAULT_PROVIDER,
    )
      ? process.env.EMBEDDING_DEFAULT_PROVIDER
      : undefined;
    const provider = providerHint ?? known?.provider ?? envProvider ?? 'ollama';
    const dimension =
      known?.dimension ??
      parseInt(process.env.EMBEDDING_DIMENSION || '1024', 10);

    const baseUrl =
      provider === 'openai'
        ? process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1'
        : process.env.OLLAMA_BASE_URL || 'http://localhost:11434';

    return {
      model: name,
      provider,
      dimension,
      baseUrl,
      apiKey: provider === 'openai' ? process.env.OPENAI_API_KEY : undefined,
    };
  }
}
