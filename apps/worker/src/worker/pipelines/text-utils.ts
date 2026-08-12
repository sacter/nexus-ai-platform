/**
 * 文本预处理工具 —— Parser / Splitter 共享
 *
 * 核心问题：PDF / 网页抽取出来的文本，\n 往往只是「折行」（甚至把词拦腰截断，
 * 如「个人所\n得税法」），而不是段落边界。若直接按 \n 切分或把 \s+ 折叠成空格，
 * 段落结构会丢失、句子会被拦腰截断。这里的 reflowParagraphs 先把折行重排回
 * 完整句子/段落，再交给后续的递归字符切割。
 */

/** 句末/分句标点：行尾出现这些标点时视为一个完整句/段，不再与下一行拼接 */
const SENTENCE_END_RE = /[。！？；：…]$/;

/**
 * CJK 字符（含全角标点），用于判断拼接处是否需要补空格。
 * 覆盖：CJK 标点 　-〿、扩展A 㐀-䶿、基本区 一-鿿、
 * 兼容区 豈-﫿、全角形式 ＀-￯。
 */
const CJK_RE = /[　-〿㐀-䶿一-鿿豈-﫿＀-￯]/;

/**
 * 折行重排：把按行抽取的文本还原成段落，段落之间以 \n\n 分隔。
 *
 * 规则：
 *  - 空行 → 段落边界；
 *  - 行尾是句末/分句标点（。！？；：…）→ 段落边界；
 *  - 否则视为折行 → 与下一行拼接。拼接处 CJK 之间不插空格，
 *    避免把「个人所\n得税法」拼成「个人所 得税法」；两侧含非 CJK 时补一个空格。
 *
 * 对已经按段落组织的文本重复执行是幂等的。
 */
export function reflowParagraphs(text: string): string {
  const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
  const paragraphs: string[] = [];
  let current = '';

  for (const raw of lines) {
    const line = raw.replace(/[ \t\f\v]+/g, ' ').trim();
    if (!line) {
      // 空行 = 段落边界
      if (current) {
        paragraphs.push(current);
        current = '';
      }
      continue;
    }
    if (current && !SENTENCE_END_RE.test(current)) {
      // 上一段还没结束 → 折行拼接
      current += joinChars(current, line) + line;
    } else {
      if (current) paragraphs.push(current);
      current = line;
    }
  }
  if (current) paragraphs.push(current);
  return paragraphs.join('\n\n');
}

/** 拼接两个片段：两侧都是 CJK 时不加空格，否则补一个空格 */
function joinChars(prev: string, next: string): string {
  const a = prev[prev.length - 1] ?? '';
  const b = next[0] ?? '';
  return CJK_RE.test(a) && CJK_RE.test(b) ? '' : ' ';
}

/** 空白归一化：统一换行符、折叠横向空白、去除行首尾空白，但保留 \n\n 段落结构 */
export function normalizeWhitespace(text: string): string {
  return text
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/[ \t\f\v]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/** 完整预处理：折行重排 → 空白归一化 */
export function preprocessText(text: string): string {
  return normalizeWhitespace(reflowParagraphs(text));
}
