/**
 * {{ 变量 }} 抽取/高亮/载荷 —— 与后端 PromptTemplateService.extractVariables 同规则。
 * 编辑器镜像层用 segments 渲染，变量 chips 用 extractVariables 实时显示接口签名。
 */

export interface ContentSegment {
  text: string
  isVar: boolean
}

const VAR_PATTERN = /\{\{\s*([\w.-]+)\s*\}\}/g

/** 从正文抽取变量名，去重保序（容忍 {{ name }} 内侧空格） */
export function extractVariables(content: string): string[] {
  const seen = new Set<string>()
  for (const m of content.matchAll(VAR_PATTERN)) {
    const v = m[1]
    if (v && !seen.has(v)) seen.add(v)
  }
  return [...seen]
}

/** 把正文切成普通/变量段，供编辑器镜像层分段高亮 */
export function highlightSegments(content: string): ContentSegment[] {
  const segments: ContentSegment[] = []
  let last = 0
  for (const m of content.matchAll(VAR_PATTERN)) {
    const start = m.index
    if (start > last) segments.push({ text: content.slice(last, start), isVar: false })
    segments.push({ text: m[0], isVar: true })
    last = start + m[0].length
  }
  if (last < content.length) segments.push({ text: content.slice(last), isVar: false })
  return segments
}

export interface PromptFormState {
  name: string
  description: string
  content: string
}

export function emptyPromptForm(): PromptFormState {
  return { name: '', description: '', content: '' }
}

/** 表单 → 提交载荷：名称/描述 trim，描述为空不落库；正文原样保留（首尾空白即语义） */
export function buildPromptPayload(form: PromptFormState) {
  const description = form.description.trim()
  return {
    name: form.name.trim(),
    ...(description ? { description } : {}),
    content: form.content,
  }
}
