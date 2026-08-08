/** 文档状态 */
export type DocumentStatus = 'UPLOADING' | 'PROCESSING' | 'READY' | 'FAILED' | 'DELETED'

/** 版本状态 */
export type VersionStatus = 'PROCESSING' | 'READY' | 'FAILED'

/** 允许上传的文件类型 */
export const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'text/markdown',
  'text/plain',
  'text/x-markdown',
] as const

export const ALLOWED_EXTENSIONS = [
  '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx', '.md', '.txt',
] as const

/**
 * 扩展名 → 规范 MIME 映射
 *
 * 浏览器 File.type 由 OS/来源程序决定，不可靠（例如 PDF 拖入时可能被报成
 * application/msword），因此上传一律以扩展名为准推导 MIME，file.type 仅作兜底。
 */
export const EXTENSION_MIME_MAP: Record<string, string> = {
  '.pdf': 'application/pdf',
  '.doc': 'application/msword',
  '.docx':
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.xls': 'application/vnd.ms-excel',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  '.ppt': 'application/vnd.ms-powerpoint',
  '.pptx':
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  '.md': 'text/markdown',
  '.txt': 'text/plain',
}

/** 文件大小上限 500MB */
export const MAX_FILE_SIZE = 500 * 1024 * 1024

/** 分片上传阈值 20MB */
export const CHUNK_THRESHOLD = 20 * 1024 * 1024

/** 分片大小 5MB */
export const CHUNK_SIZE = 5 * 1024 * 1024

/** 文档版本 */
export interface DocumentVersion {
  id: string
  documentId: string
  versionNumber: number
  fileUrl: string
  pageCount: number
  chunkCount: number
  status: VersionStatus
  changeSummary?: string
  createdBy?: string
  createdByUser?: { id: string; username: string }
  createdAt: string
}

/** 文档 */
export interface Document {
  id: string
  kbId: string
  userId?: string
  currentVersionId?: string
  name: string
  originalName: string
  url: string
  fileSize: number
  mimeType: string
  pageCount?: number
  status: DocumentStatus
  chunkCount: number
  embeddingModel?: string
  embeddingDim?: number
  errorMessage?: string
  createdAt: string
  updatedAt: string
  currentVersion?: DocumentVersion
  user?: { id: string; username: string }
  versions?: DocumentVersion[]
}

/** MinIO STS 临时凭证 */
export interface StsCredentials {
  accessKeyId: string
  secretAccessKey: string
  sessionToken: string
  expiration: number
  bucket: string
  prefix: string
  endpoint: string
  useSSL: boolean
  port: number
}

/** 保存元数据请求 */
export interface SaveMetaRequest {
  name: string
  originalName: string
  url: string
  fileSize: number
  mimeType: string
  pageCount?: number
  idempotencyKey?: string
}

/** 保存元数据响应 */
export interface SaveMetaResponse {
  document: Document
  version: DocumentVersion
  isNew: boolean
}

/** 上传文件项（本地状态） */
export interface UploadFileItem {
  id: string
  file: File
  name: string
  status: 'pending' | 'uploading' | 'success' | 'failed' | 'paused'
  progress: number
  error?: string
  objectKey?: string
}

/** 下载 URL 响应 */
export interface DownloadUrlResponse {
  url: string
  objectKey: string
  expiresIn: number
}
