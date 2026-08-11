import http from '@/api/client'
import type { SearchRequest, SearchResponse } from '@/modules/knowledge/types/retrieval'

export const retrievalApi = {
  /** 知识检索：向量/混合搜索 */
  search: (data: SearchRequest) => http.post<SearchResponse>('/retrieval/search', data),
}
