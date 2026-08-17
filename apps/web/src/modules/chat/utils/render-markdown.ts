import MarkdownIt from 'markdown-it'
import DOMPurify from 'dompurify'

const md = new MarkdownIt({ html: false, linkify: true, breaks: true })

export function renderMarkdown(src: string): string {
  if (!src) return ''
  return DOMPurify.sanitize(md.render(src), { USE_PROFILES: { html: true } })
}
