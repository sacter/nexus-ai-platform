import http from '@/api/client'
import type { ChunkListParams, ChunkListResponse } from '@/modules/knowledge/types/chunk'

export const chunksApi = {
  /** 分页查询知识库切片；documentId 缺省 = 全部文档 */
  list: (kbId: string, params?: ChunkListParams) =>
    http.get<ChunkListResponse>(`/knowledge-bases/${kbId}/chunks`, { params }),
}
