export type JobStatus = 'PENDING' | 'RUNNING' | 'DONE' | 'FAILED'
export type JobType = 'INDEX' | 'REINDEX' | 'DELETE_CHUNKS'

export interface IndexJob {
  id: string
  bizId: string | null
  documentId: string
  documentName: string
  kbId: string
  kbName: string
  versionId: string | null
  versionNumber: number | null
  type: JobType
  status: JobStatus
  progress: number
  totalSteps: number
  currentStep: number
  stepDescription: string | null
  errorMessage: string | null
  retryCount: number
  startedAt: string | null
  completedAt: string | null
  createdAt: string
  updatedAt: string
}

export interface JobListResponse {
  items: IndexJob[]
  total: number
  page: number
  pageSize: number
}

export interface JobListParams {
  documentId?: string
  kbId?: string
  status?: JobStatus | ''
  type?: JobType | ''
  keyword?: string
  page?: number
  pageSize?: number
}
