import http from '@/api/client'
import type {
  ApiKey,
  ApiKeyCreateInput,
  ApiKeyCreateResult,
  ApiKeyUpdateInput,
} from '../types/api-key'

export const apiKeysApi = {
  /** API Key 列表（密钥已脱敏） */
  list: () => http.get<ApiKey[]>('/api/v1/api-keys'),
  /** 添加 API Key，响应包含完整密钥（仅此一次） */
  create: (data: ApiKeyCreateInput) => http.post<ApiKeyCreateResult>('/api/v1/api-keys', data),
  /** 更新 API Key（provider/name/model/base_url/is_active，密钥不修改） */
  update: (id: string, data: ApiKeyUpdateInput) => http.patch<ApiKey>(`/api/v1/api-keys/${id}`, data),
  /** 删除 API Key */
  delete: (id: string) => http.delete<void>(`/api/v1/api-keys/${id}`),
}
