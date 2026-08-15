/**
 * 模型注册表（models）前端类型 — 与 DATABASE.md 4.20 表结构 / 后端 Prisma 返回一致（camelCase）
 * api_keys 凭证层 + models 注册层解耦：models.apiKeyId → api_keys.id，一个凭证可被多个模型引用
 */

/** 模型类型枚举（models.type: chat | embedding | rerank） */
export const MODEL_TYPES = [
  { value: 'chat', label: 'Chat', desc: '对话模型' },
  { value: 'embedding', label: 'Embedding', desc: '嵌入模型' },
  { value: 'rerank', label: 'Rerank', desc: '重排序模型' },
] as const

export type ModelType = (typeof MODEL_TYPES)[number]['value']

// 模型能力参数结构 / 默认值 / 取值范围 — 单一来源 @nexus/model-config（DATABASE.md 4.20 config）
// 类型经 import type 本地绑定再 export type 导出，避免 Rollup 对 CJS 包的 `export type {} from` 报错
import {
  MODEL_CONFIG_DEFAULTS,
  PROVIDERS as MODELS_PROVIDERS,
  type ModelChatConfig,
  type ModelConfig,
  type ModelEmbeddingConfig,
  type ModelRerankConfig,
} from '@nexus/model-config'
/** Provider 枚举（与 api_keys.provider 对应；brand 色用于品牌徽章，多主题下经 color-mix 混合保持协调） */
export const PROVIDERS = MODELS_PROVIDERS;
export type ModelProvider = (typeof PROVIDERS)[number]['value']
export type { ModelChatConfig, ModelEmbeddingConfig, ModelRerankConfig, ModelConfig }
export { MODEL_CONFIG_DEFAULTS, MODEL_CONFIG_LIMITS } from '@nexus/model-config'

/** 模型注册项（apiKeyName 由列表查询 LEFT JOIN api_keys 附带返回） */
export interface Model {
  id: string
  provider: ModelProvider
  modelName: string
  type: ModelType
  displayName: string
  description?: string | null
  /** 关联凭证 id；null = 使用环境变量默认 */
  apiKeyId?: string | null
  /** 关联凭证名称（来自 api_keys.name） */
  apiKeyName?: string | null
  config: ModelConfig
  isActive: boolean
  createdAt: string
  updatedAt: string
}

/** 创建模型入参 */
export interface ModelCreateInput {
  provider: ModelProvider
  modelName: string
  type: ModelType
  displayName: string
  description?: string | null
  apiKeyId?: string | null
  config: ModelConfig
}

/** 更新模型入参（全量 PATCH，与后端 DTO 对齐） */
export interface ModelUpdateInput extends ModelCreateInput {
  isActive: boolean
}

/** 按类型返回 config 默认模板（取自 @nexus/model-config MODEL_CONFIG_DEFAULTS） */
export function createDefaultConfig(type: ModelType): ModelConfig {
  return MODEL_CONFIG_DEFAULTS[type]
}
