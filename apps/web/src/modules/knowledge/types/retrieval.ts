/** 检索请求参数 */
export interface SearchRequest {
  query: string
  kbId: string
  strategy?: 'vector' | 'hybrid'
  topK?: number // 1-100，默认 5
  denseTopK?: number // 1-200，默认 20
  sparseTopK?: number // 1-200，默认 20
  rerank?: boolean // 默认 true
}

/** 引用信息 */
export interface Citation {
  documentName: string
  page: number
  version: string
  snippet: string
}

/** 单条检索结果 */
export interface SearchResult {
  chunkId: string
  documentId: string
  documentName: string
  page: number
  content: string
  score: number // [0, 1]
  tokenCount: number
  citation: Citation
}

/** 检索响应 */
export interface SearchResponse {
  results: SearchResult[]
  strategy: 'vector' | 'hybrid'
  totalCandidates: number
}
