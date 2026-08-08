/** 切片 */
export interface Chunk {
  id: string
  documentId: string
  documentName: string
  versionId: string
  page: number
  chunkIndex: number
  content: string
  tokenCount: number
  metadata: Record<string, unknown>
  parentChunkId: string | null
  isEmbedded: boolean
  embeddingModels: string[]
  createdAt: string
}

/** 切片列表查询参数 */
export interface ChunkListParams {
  documentId?: string
  page?: number
  pageSize?: number
}

/** 切片列表响应 */
export interface ChunkListResponse {
  items: Chunk[]
  total: number
  page: number
  pageSize: number
}
