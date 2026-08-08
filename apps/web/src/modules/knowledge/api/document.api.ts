import http from '@/api/client'
import type {
  Document,
  DocumentVersion,
  StsCredentials,
  SaveMetaRequest,
  SaveMetaResponse,
  DownloadUrlResponse,
  ReindexResponse,
  DocumentListResponse,
} from '@/modules/knowledge/types/document'

export const documentsApi = {
  /** 获取文档列表 */
  list: (kbId: string, params?: { status?: string }) =>
    http.get<Document[]>(`/knowledge-bases/${kbId}/documents`, { params }),

  /** 分页查询文档列表（可选 keyword 按文档名模糊过滤） */
  listPaged: (kbId: string, params: { page: number; pageSize: number; keyword?: string }) =>
    http.get<DocumentListResponse>(`/knowledge-bases/${kbId}/documents`, { params }),

  /** 获取文档详情 */
  get: (kbId: string, id: string) =>
    http.get<Document>(`/knowledge-bases/${kbId}/documents/${id}`),

  /** 上传完成后回写元数据 */
  saveMeta: (kbId: string, data: SaveMetaRequest) =>
    http.post<SaveMetaResponse>(
      `/knowledge-bases/${kbId}/documents/save-meta`,
      data,
    ),

  /** 更新文档信息 */
  update: (kbId: string, id: string, data: Partial<Document>) =>
    http.patch<Document>(
      `/knowledge-bases/${kbId}/documents/${id}`,
      data,
    ),

  /** 软删除文档 */
  delete: (kbId: string, id: string) =>
    http.delete<void>(`/knowledge-bases/${kbId}/documents/${id}`),

  /** 获取版本历史 */
  getVersions: (kbId: string, docId: string) =>
    http.get<DocumentVersion[]>(
      `/knowledge-bases/${kbId}/documents/${docId}/versions`,
    ),

  /** 切换活跃版本 */
  activateVersion: (kbId: string, docId: string, versionId: string) =>
    http.patch<Document>(
      `/knowledge-bases/${kbId}/documents/${docId}/activate-version`,
      { versionId },
    ),

  /** 获取下载/预览预签名 URL */
  getDownloadUrl: (kbId: string, docId: string, versionId?: string) =>
    http.get<DownloadUrlResponse>(
      `/knowledge-bases/${kbId}/documents/${docId}/download-url`,
      { params: versionId ? { versionId } : {} },
    ),

  /** 重新索引（重新切片 + 向量化） */
  reindex: (kbId: string, id: string) =>
    http.post<ReindexResponse>(
      `/knowledge-bases/${kbId}/documents/${id}/reindex`,
    ),
}

export const uploadApi = {
  /** 获取 MinIO STS 临时凭证 */
  getSts: (kbId: string) =>
    http.get<StsCredentials & { allowedTypes: { mimeTypes: string[]; extensions: string[] } }>(
      `/upload/get-minio-sts`,
      { params: { kbId } },
    ),
}
