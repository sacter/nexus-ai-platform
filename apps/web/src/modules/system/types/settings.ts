/**
 * 系统设置类型定义（与 DATABASE.md §4.13 system_settings.config JSONB 结构对齐）
 */
export interface SettingsEmbedding {
  provider: string
  model: string
  dimension: number
}

export interface SettingsChunk {
  size: number
  overlap: number
}

export type RetrievalStrategy = 'vector' | 'hybrid'

export interface SettingsRetrieval {
  topK: number
  similarityThreshold: number
  strategy: RetrievalStrategy
}

export interface SettingsRerank {
  enabled: boolean
  topN: number
  rerankTopK: number
  model: string
}

export interface SettingsQueryRewrite {
  enabled: boolean
  count: number
}

export interface SettingsSystem {
  maxFileSize: number
  allowedTypes: string[]
}

export interface Settings {
  embedding: SettingsEmbedding
  chunk: SettingsChunk
  retrieval: SettingsRetrieval
  rerank: SettingsRerank
  queryRewrite: SettingsQueryRewrite
  system: SettingsSystem
}

export const DEFAULT_SETTINGS: Settings = {
  embedding: {
    provider: 'openai',
    model: 'text-embedding-3-small',
    dimension: 1536,
  },
  chunk: {
    size: 1000,
    overlap: 200,
  },
  retrieval: {
    topK: 20,
    similarityThreshold: 0.7,
    strategy: 'vector',
  },
  rerank: {
    enabled: false,
    topN: 20,
    rerankTopK: 5,
    model: 'bge-reranker-v2-m3',
  },
  queryRewrite: {
    enabled: false,
    count: 3,
  },
  system: {
    maxFileSize: 52428800,
    allowedTypes: [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ],
  },
}

export type UploadTypeKey = 'pdf' | 'word' | 'markdown' | 'text'

export const UPLOAD_TYPE_OPTIONS: Array<{
  key: UploadTypeKey
  label: string
  mime: string
  description: string
}> = [
  { key: 'pdf', label: 'PDF 文档', mime: 'application/pdf', description: '适合合同、报告、论文' },
  { key: 'word', label: 'Word 文档', mime: 'application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document', description: '支持 doc / docx 格式' },
  { key: 'markdown', label: 'Markdown 文档', mime: 'text/markdown', description: '适合结构化说明文档' },
  { key: 'text', label: 'TXT 文本', mime: 'text/plain', description: '适合纯文本与脚本日志' },
]

export function cloneDefaultSettings(): Settings {
  return JSON.parse(JSON.stringify(DEFAULT_SETTINGS)) as Settings
}

export function mergeSettings(partial?: Partial<Settings> | null): Settings {
  const defaults = cloneDefaultSettings()
  if (!partial) return defaults
  return {
    embedding: { ...defaults.embedding, ...partial.embedding },
    chunk: { ...defaults.chunk, ...partial.chunk },
    retrieval: { ...defaults.retrieval, ...partial.retrieval },
    rerank: { ...defaults.rerank, ...partial.rerank },
    queryRewrite: { ...defaults.queryRewrite, ...partial.queryRewrite },
    system: { ...defaults.system, ...partial.system },
  }
}

export function hasSettingsChanged(a: Settings | null, b: Settings | null): boolean {
  if (!a || !b) return false
  return JSON.stringify(a) !== JSON.stringify(b)
}

export const SETTINGS_LIMITS = {
  chunkSize: { min: 100, max: 8000 },
  chunkOverlap: { min: 0, max: 2000 },
  similarityThreshold: { min: 0, max: 1 },
  retrievalTopK: { min: 1, max: 100 },
  rerankTopK: { min: 1, max: 50 },
  rerankTopN: { min: 1, max: 100 },
  queryRewriteCount: { min: 1, max: 10 },
  maxFileSizeMB: { min: 1, max: 200 },
} as const
