import type { IndexJob, JobStatus, JobType } from '../types/job'

export const JOB_STATUS_OPTIONS: Array<{ label: string; value: JobStatus | '' }> = [
  { label: '全部状态', value: '' },
  { label: '排队中', value: 'PENDING' },
  { label: '执行中', value: 'RUNNING' },
  { label: '已完成', value: 'DONE' },
  { label: '失败', value: 'FAILED' },
]

export const JOB_TYPE_OPTIONS: Array<{ label: string; value: JobType | '' }> = [
  { label: '全部类型', value: '' },
  { label: '首次索引', value: 'INDEX' },
  { label: '重新索引', value: 'REINDEX' },
  { label: '清理切片', value: 'DELETE_CHUNKS' },
]

export function jobStatusLabel(status: JobStatus): string {
  const map: Record<JobStatus, string> = {
    PENDING: '排队中',
    RUNNING: '执行中',
    DONE: '已完成',
    FAILED: '失败',
  }
  return map[status]
}

export function jobStatusTagType(status: JobStatus): 'success' | 'warning' | 'danger' | 'info' {
  const map: Record<JobStatus, 'success' | 'warning' | 'danger' | 'info'> = {
    PENDING: 'info',
    RUNNING: 'warning',
    DONE: 'success',
    FAILED: 'danger',
  }
  return map[status]
}

export function jobTypeLabel(type: JobType): string {
  const map: Record<JobType, string> = {
    INDEX: '首次索引',
    REINDEX: '重新索引',
    DELETE_CHUNKS: '清理切片',
  }
  return map[type]
}

export function canCancelJob(job: IndexJob): boolean {
  return job.status === 'PENDING' || job.status === 'RUNNING'
}

export function canRetryJob(job: IndexJob): boolean {
  return job.status === 'FAILED' && !!job.bizId
}

export function jobDuration(job: IndexJob): string {
  if (!job.startedAt) return '--'
  const start = new Date(job.startedAt).getTime()
  const end = job.completedAt ? new Date(job.completedAt).getTime() : Date.now()
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) return '--'
  const seconds = Math.max(0, Math.round((end - start) / 1000))
  if (seconds < 60) return `${seconds}s`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ${seconds % 60}s`
  const hours = Math.floor(minutes / 60)
  return `${hours}h ${minutes % 60}m`
}

export function jobSummary(job: IndexJob): string {
  const step =
    job.totalSteps > 0
      ? `步骤 ${Math.min(job.currentStep, job.totalSteps)}/${job.totalSteps}`
      : '等待步骤信息'
  const description = job.stepDescription?.trim()
  return description ? `${step} · ${description}` : step
}
