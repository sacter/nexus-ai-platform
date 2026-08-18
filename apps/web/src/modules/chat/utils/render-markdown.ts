import MarkdownIt from 'markdown-it'
import DOMPurify from 'dompurify'

const md = new MarkdownIt({ html: false, linkify: true, breaks: true })

// 链接强制新标签打开（spec §4.1 链接新标签）；rel 防 reverse tabnabbing。
// markdown-it 注入 target/rel，DOMPurify 须显式放行（默认会剥离 target），ChatMessage.spec 覆盖这一契约。
const defaultLinkRender = md.renderer.rules.link_open
  || ((tokens, idx, options, _env, self) => self.renderToken(tokens, idx, options))
md.renderer.rules.link_open = (tokens, idx, options, env, self) => {
  const token = tokens[idx]
  const setAttr = (name: string, value: string) => {
    const i = token.attrIndex(name)
    if (i < 0) token.attrPush([name, value])
    else if (token.attrs) token.attrs[i][1] = value
  }
  setAttr('target', '_blank')
  setAttr('rel', 'noopener noreferrer')
  return defaultLinkRender(tokens, idx, options, env, self)
}

export function renderMarkdown(src: string): string {
  if (!src) return ''
  return DOMPurify.sanitize(md.render(src), {
    USE_PROFILES: { html: true },
    ADD_ATTR: ['target', 'rel'],
  })
}
