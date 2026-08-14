/** Provider 可选值（与 api_keys.provider 列一致） */
export const PROVIDERS = [
  { label: 'OpenAI', value: 'openai' },
  { label: 'DashScope', value: 'dashscope' },
  { label: 'DeepSeek', value: 'deepseek' },
  { label: 'BGE', value: 'bge' },
  { label: 'Cohere', value: 'cohere' },
  { label: 'Anthropic', value: 'anthropic' },
] as const

export type ProviderId = (typeof PROVIDERS)[number]['value']

/** API Key（列表返回，api_key 为脱敏后的值；字段与 api_keys 表一致） */
export interface ApiKey {
  id: string
  provider: ProviderId
  /** 便于识别的名称 */
  name: string
  /** 默认模型 */
  model: string
  /** 自定义 API 端点（如代理） */
  base_url?: string | null
  /** 脱敏后的密钥串，如 sk-****-****-f3a2 */
  api_key: string
  is_active: boolean
  created_by: string
  created_at: string
  updated_at: string
}

/** 创建 API Key 入参（api_key 为密钥明文，仅创建时提交） */
export interface ApiKeyCreateInput {
  provider: ProviderId
  name: string
  model: string
  base_url?: string | null
  api_key: string
}

/** 更新 API Key 入参（密钥加密存储，编辑时不修改） */
export interface ApiKeyUpdateInput {
  provider: ProviderId
  name: string
  model: string
  base_url?: string | null
  is_active: boolean
}

/** 创建 API Key 响应：完整密钥仅在创建时返回一次 */
export interface ApiKeyCreateResult extends ApiKey {
  /** 完整密钥，仅创建响应返回，此后列表仅可见脱敏值 */
  api_key: string
}
