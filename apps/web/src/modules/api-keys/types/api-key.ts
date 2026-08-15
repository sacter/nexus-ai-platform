/** Provider 可选值（与 api_keys.provider 列一致） */
import { PROVIDERS as MODELS_PROVIDERS } from '@nexus/model-config'
export const PROVIDERS = MODELS_PROVIDERS;
export type ProviderId = (typeof PROVIDERS)[number]['value']

/** API Key（列表返回，apiKey 为脱敏后的明文，如 sk-a****f3a2；字段名与后端 Prisma 返回一致，camelCase） */
export interface ApiKey {
  id: string
  provider: ProviderId
  /** 便于识别的名称 */
  name: string
  /** 默认模型 */
  model: string
  /** 自定义 API 端点（如代理） */
  baseUrl?: string | null
  /** 脱敏后的密钥串（完整明文仅在创建时返回一次） */
  apiKey: string
  isActive: boolean
  createdBy: string
  createdAt: string
  updatedAt: string
}

/** API Key 公钥（用于客户端加密存储） */
export interface ApiKeyPublicKey {
  publicKey: string
}

/** 创建 API Key 入参（apiKey 为前端 RSA 加密后的密文，与后端 DTO camelCase 对齐） */
export interface ApiKeyCreateInput {
  provider: ProviderId
  name: string
  model: string
  baseUrl?: string | null
  apiKey: string
}

/** 更新 API Key 入参（密钥加密存储，编辑时不修改） */
export interface ApiKeyUpdateInput {
  provider: ProviderId
  name: string
  model: string
  baseUrl?: string | null
  isActive: boolean
}

/** 创建 API Key 响应：完整密钥仅在创建时返回一次 */
export interface ApiKeyCreateResult extends ApiKey {
  /** 完整密钥，仅创建响应返回，此后列表仅可见脱敏值 */
  apiKey: string
}
