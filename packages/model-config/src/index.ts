/**
 * Model Center — 模型能力参数配置（单一来源）
 *
 * 对应 DATABASE.md §4.20 `models.config` 的结构约束：
 *   chat:      {maxTokens, temperature, supportsVision, supportsTools}
 *   embedding: {dimension, maxBatchSize}
 *   rerank:    {maxBatchSize}
 *
 * 由后端 ModelService.validateConfig 与前端 ModelForm/ModelList 共同消费，
 * 避免取值范围 / 默认值两端漂移。
 */

/** 模型类型（models.type: chat | embedding | rerank） */
export type ModelConfigType = 'chat' | 'embedding' | 'rerank';

/** config — chat 模型能力参数 */
export interface ModelChatConfig {
  maxTokens?: number;
  temperature?: number;
  supportsVision?: boolean;
  supportsTools?: boolean;
}

/** config — embedding 模型能力参数 */
export interface ModelEmbeddingConfig {
  dimension?: number;
  maxBatchSize?: number;
}

/** config — rerank 模型能力参数 */
export interface ModelRerankConfig {
  maxBatchSize?: number;
}

export type ModelConfig =
  | ModelChatConfig
  | ModelEmbeddingConfig
  | ModelRerankConfig;

/** 能力参数取值范围 — 前端输入控件上限 + 后端 validateConfig 共用 */
export const MODEL_CONFIG_LIMITS = {
  chat: {
    maxTokens: { min: 1, max: 128000 },
    temperature: { min: 0, max: 1 },
  },
  embedding: {
    dimension: { min: 1, max: 3072 },
    maxBatchSize: { min: 1, max: 10240 },
  },
  rerank: {
    maxBatchSize: { min: 1, max: 10240 },
  },
} as const;

/** 能力参数默认值 — 注册表单新建时预填（DATABASE.md 4.20 config 注释） */
export const MODEL_CONFIG_DEFAULTS = {
  chat: {
    maxTokens: 4096,
    temperature: 0.7,
    supportsVision: false,
    supportsTools: true,
  },
  embedding: { dimension: 1536, maxBatchSize: 2048 },
  rerank: { maxBatchSize: 100 },
} as const satisfies Record<ModelConfigType, ModelConfig>;

/** Provider 枚举（与 api_keys.provider 对应；brand 色用于品牌徽章） */
export const PROVIDERS = [
  { value: 'deepseek', label: 'DeepSeek', brand: '#4d6bfe' },
  { value: 'qwen', label: 'Qwen', brand: '#6d5ef2' },
  { value: 'bge', label: 'BGE', brand: '#e5484d' },
  { value: 'ollama', label: 'Ollama', brand: '#181f1c' },
  { value: 'openai', label: 'OpenAI', brand: '#10a37f' },
  { value: 'anthropic', label: 'Anthropic', brand: '#d97757' },
  { value: 'dashscope', label: 'DashScope', brand: '#168fff' },
] as const satisfies readonly { value: string; label: string; brand: string }[];
