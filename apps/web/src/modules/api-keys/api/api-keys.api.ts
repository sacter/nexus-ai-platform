import http from '@/api/client'
import type {
  ApiKey,
  ApiKeyPublicKey,
  ApiKeyCreateInput,
  ApiKeyCreateResult,
  ApiKeyUpdateInput,
} from '../types/api-key'

export const apiKeysApi = {
  /** API Key 列表（密钥已脱敏） */
  list: () => http.get<ApiKey[]>('/api-keys'),
  /** API Key 创建公钥 */
  publicKey: () => http.get<ApiKeyPublicKey>('/api-keys/public-key'),
  /** 添加 API Key，响应包含完整密钥（仅此一次） */
  create: (data: ApiKeyCreateInput) => http.post<ApiKeyCreateResult>('/api-keys', data),
  /** 更新 API Key（provider/name/model/baseUrl/isActive，密钥不修改） */
  update: (id: string, data: ApiKeyUpdateInput) => http.patch<ApiKey>(`/api-keys/${id}`, data),
  /** 删除 API Key */
  delete: (id: string) => http.delete<void>(`/api-keys/${id}`),
}
