import { describe, expect, it } from 'vitest'
import {
  canCancelJob,
  canRetryJob,
  jobDuration,
  jobStatusLabel,
  jobSummary,
  jobTypeLabel,
} from '../utils/job-display'
import type { IndexJob } from '../types/job'

function makeJob(overrides: Partial<IndexJob> = {}): IndexJob {
  return {
    id: 'job-1',
    bizId: 'version-1',
    documentId: 'doc-1',
    documentName: '系统需求说明书.pdf',
    kbId: 'kb-1',
    kbName: '研发知识库',
    versionId: 'version-1',
    versionNumber: 3,
    type: 'INDEX',
    status: 'RUNNING',
    progress: 40,
    totalSteps: 5,
    currentStep: 2,
    stepDescription: '向量化切片',
    errorMessage: null,
    retryCount: 0,
    startedAt: '2026-08-01T08:00:00.000Z',
    completedAt: null,
    createdAt: '2026-08-01T07:59:00.000Z',
    updatedAt: '2026-08-01T08:05:00.000Z',
    ...overrides,
  }
}

describe('job-display', () => {
  it('映射状态与类型文案', () => {
    expect(jobStatusLabel('PENDING')).toBe('排队中')
    expect(jobStatusLabel('FAILED')).toBe('失败')
    expect(jobTypeLabel('DELETE_CHUNKS')).toBe('清理切片')
  })

  it('仅执行中/排队中可取消，失败且有 bizId 才可重试', () => {
    expect(canCancelJob(makeJob({ status: 'PENDING' }))).toBe(true)
    expect(canCancelJob(makeJob({ status: 'DONE' }))).toBe(false)
    expect(canRetryJob(makeJob({ status: 'FAILED' }))).toBe(true)
    expect(canRetryJob(makeJob({ status: 'FAILED', bizId: null }))).toBe(false)
  })

  it('生成步骤摘要，优先包含当前步骤描述', () => {
    expect(jobSummary(makeJob())).toBe('步骤 2/5 · 向量化切片')
    expect(jobSummary(makeJob({ totalSteps: 0, stepDescription: '   ' }))).toBe('等待步骤信息')
  })

  it('根据开始/完成时间计算耗时', () => {
    expect(
      jobDuration(
        makeJob({
          startedAt: '2026-08-01T08:00:00.000Z',
          completedAt: '2026-08-01T08:01:10.000Z',
        }),
      ),
    ).toBe('1m 10s')
    expect(jobDuration(makeJob({ startedAt: null }))).toBe('--')
  })
})
