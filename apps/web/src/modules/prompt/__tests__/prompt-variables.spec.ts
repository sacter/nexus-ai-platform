import { describe, expect, it } from 'vitest'
import {
  buildPromptPayload,
  emptyPromptForm,
  extractVariables,
  highlightSegments,
} from '../utils/prompt-variables'

describe('extractVariables', () => {
  it('抽取 {{var}} 并去重保序，容忍内侧空格', () => {
    expect(
      extractVariables('Ctx: {{ context }} Q: {{question}} 再来 {{context}}'),
    ).toEqual(['context', 'question'])
  })

  it('支持字母数字下划线、点与短横；非占位语法忽略', () => {
    expect(extractVariables('{{kb.name}} {{user-id}} {{_v1}}')).toEqual([
      'kb.name',
      'user-id',
      '_v1',
    ])
    // 变量名中间含空格不构成占位符（{{ }} 内部空白只允许在首尾）
    expect(extractVariables('{single} {{ spaced  var }} x{{')).toEqual([])
  })

  it('无变量返回空数组', () => {
    expect(extractVariables('')).toEqual([])
    expect(extractVariables('纯文本 {{ }')).toEqual([])
  })
})

describe('highlightSegments', () => {
  it('把正文切成普通/变量段并保持原文顺序', () => {
    const segs = highlightSegments('A {{x}} B {{ y }} C')
    expect(segs).toEqual([
      { text: 'A ', isVar: false },
      { text: '{{x}}', isVar: true },
      { text: ' B ', isVar: false },
      { text: '{{ y }}', isVar: true },
      { text: ' C', isVar: false },
    ])
    expect(segs.map((s) => s.text).join('')).toBe('A {{x}} B {{ y }} C')
  })

  it('纯文本/空文本退化为单段或空数组', () => {
    expect(highlightSegments('hello')).toEqual([{ text: 'hello', isVar: false }])
    expect(highlightSegments('')).toEqual([])
  })
})

describe('buildPromptPayload', () => {
  it('trim 名称与描述，空描述不落库，正文原样保留', () => {
    const payload = buildPromptPayload({
      ...emptyPromptForm(),
      name: '  RAG 默认  ',
      description: '   ',
      content: ' line1\nline2 ',
    })
    expect(payload.name).toBe('RAG 默认')
    expect(payload).not.toHaveProperty('description')
    expect(payload.content).toBe(' line1\nline2 ')
  })

  it('有描述时携带 trim 后的描述', () => {
    const payload = buildPromptPayload({
      name: 'x',
      description: '  严谨回答  ',
      content: 'c',
    })
    expect(payload.description).toBe('严谨回答')
  })
})
