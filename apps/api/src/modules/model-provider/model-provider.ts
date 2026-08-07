/**
 * ★ 统一模型提供文件
 *
 * 集中管理 Embedding 模型 → Provider 的注册表与解析规则。
 * 任何模块（Worker 索引 / 客户提问 Embedding / 检索）都通过
 * ModelProviderService 获取模型配置，禁止各自硬编码模型名。
 */
export type EmbeddingProviderName = 'ollama' | 'openai';

export interface EmbeddingModelConfig {
  model: string;
  provider: EmbeddingProviderName;
  dimension: number;
  baseUrl: string;
  apiKey?: string;
}

/** 内置已知模型注册表（可扩展，DB models 表为 V2 增强） */
const KNOWN_MODELS: Record<string, { provider: EmbeddingProviderName; dimension: number }> = {
  'bge-m3': { provider: 'ollama', dimension: 1024 },
  'nomic-embed-text': { provider: 'ollama', dimension: 768 },
  'text-embedding-3-small': { provider: 'openai', dimension: 1536 },
};

const VALID_PROVIDERS: EmbeddingProviderName[] = ['ollama', 'openai'];

export function isEmbeddingProviderName(value: string | undefined): value is EmbeddingProviderName {
  return !!value && (VALID_PROVIDERS as string[]).includes(value);
}

export function parseModelName(model: string): {
  provider?: EmbeddingProviderName;
  name: string;
} {
  if (model.includes('/')) {
    const [provider, name] = model.split('/');
    return {
      provider: isEmbeddingProviderName(provider) ? provider : undefined,
      name,
    };
  }
  return { name: model };
}

export function resolveKnownModel(name: string): { provider: EmbeddingProviderName; dimension: number } | undefined {
  return KNOWN_MODELS[name];
}
