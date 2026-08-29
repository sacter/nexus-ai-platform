import { describe, expect, it } from 'vitest'
import {
  DEFAULT_SETTINGS,
  SETTINGS_LIMITS,
  UPLOAD_TYPE_OPTIONS,
  cloneDefaultSettings,
  hasSettingsChanged,
  mergeSettings,
} from '../types/settings'

describe('settings type helpers', () => {
  it('merges partial backend payloads over defaults', () => {
    const merged = mergeSettings({
      retrieval: { topK: 30, similarityThreshold: 0.8, strategy: 'hybrid' },
    })
    expect(merged.embedding.model).toBe(DEFAULT_SETTINGS.embedding.model)
    expect(merged.retrieval.topK).toBe(30)
    expect(merged.system.maxFileSize).toBe(DEFAULT_SETTINGS.system.maxFileSize)
  })

  it('cloneDefaultSettings returns an isolated copy', () => {
    const draft = cloneDefaultSettings()
    draft.chunk.size = 2048
    expect(DEFAULT_SETTINGS.chunk.size).toBe(1000)
  })

  it('detects dirty state through JSON comparison', () => {
    const draft = cloneDefaultSettings()
    expect(hasSettingsChanged(draft, DEFAULT_SETTINGS)).toBe(false)
    draft.rerank.enabled = true
    expect(hasSettingsChanged(draft, DEFAULT_SETTINGS)).toBe(true)
  })

  it('upload type options expose unique keys and mimes', () => {
    const keys = UPLOAD_TYPE_OPTIONS.map((option) => option.key)
    expect(new Set(keys).size).toBe(keys.length)
    expect(UPLOAD_TYPE_OPTIONS.every((option) => option.mime.length > 0)).toBe(true)
  })

  it('limits are consistent for overlapping chunk bounds', () => {
    expect(SETTINGS_LIMITS.chunkOverlap.max).toBeLessThan(SETTINGS_LIMITS.chunkSize.max)
    expect(SETTINGS_LIMITS.maxFileSizeMB.min).toBeGreaterThan(0)
  })
})
