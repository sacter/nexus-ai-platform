import { createHash } from 'crypto';
import { preprocessText } from '../text-utils';
import {
  SplitChunk,
  SplitOptions,
  TextSplitterPort,
} from './splitter.interface';

/** 分割分隔符，优先级从高到低：段落空行 → 换行 → 中文句末 → 英文句末 → 叹号/问号 → 词（空格） */
const DEFAULT_SEPARATORS = ['\n\n', '\n', '。', '.', '！', '？', ' '];

/**
 * 文本分割器 —— 递归字符分割
 *
 *  - 规整文本时保留段落结构（\n\n / \n），避免把段落边界抹平后只能从句子中间截断；
 *  - 按优先级递归切割：段落 → 行 → 句末标点 → 词，完整句子/段落尽量留在同一个 chunk；
 *  - 相邻 chunk 之间带真实 overlap：重叠文字取自上一 chunk 尾部，并尽量从完整句子开始，
 *    保证检索时跨 chunk 的语义不会丢失。
 *
 * 默认 chunkSize=800 字符（约 200-400 token），overlap=80。
 * 受 overlap 影响，单个 chunk 最长可达 chunkSize + overlap（chunkSize 是目标值而非硬上限）。
 */
export class TextSplitter implements TextSplitterPort {
  private readonly defaultChunkSize = 800;
  private readonly defaultOverlap = 80;

  split(
    pages: Array<{
      pageNumber: number;
      content: string;
      metadata?: Record<string, unknown>;
    }>,
    opts?: SplitOptions,
  ): SplitChunk[] {
    const chunkSize = opts?.chunkSize ?? this.defaultChunkSize;
    // overlap 过大时相邻 chunk 会重复整段，限制最多 chunkSize 的一半
    const overlap = Math.min(
      opts?.chunkOverlap ?? this.defaultOverlap,
      Math.floor(chunkSize / 2),
    );

    const chunks: SplitChunk[] = [];
    let index = 0;
    // 跨页续接：PDF 常把句子/词拦在页边界（如「财产转让所\n得」），
    // 把上一页未结束的尾部接到本页开头再重排，让断句/断词重新接续。
    let carryOver = '';

    for (const page of pages) {
      const raw = (page.content ?? '').trim();
      if (!raw) continue;

      const text = this.normalize(carryOver ? carryOver + '\n' + raw : raw);
      if (!text) continue;
      carryOver = this.extractDanglingTail(text);

      const pieces = this.splitIntoPieces(text, DEFAULT_SEPARATORS, chunkSize);
      const contents = this.mergeWithOverlap(
        pieces,
        chunkSize,
        overlap,
        DEFAULT_SEPARATORS,
      );

      for (const content of contents) {
        chunks.push({
          page: page.pageNumber,
          chunkIndex: index++,
          content,
          contentHash: createHash('sha256').update(content).digest('hex'),
          tokenCount: Math.ceil(content.length / 4),
          metadata: { ...page.metadata },
        });
      }
    }
    return chunks;
  }

  /**
   * 规整文本：折行重排 + 空白归一化（保留 \n\n / \n 段落结构）。
   * 与 Parser 共用 preprocessText，幂等。旧实现的 \s+ → ' ' 会把段落边界抹平，
   * 导致后续无法按段落/句末切割。
   */
  private normalize(content: string): string {
    return preprocessText(content);
  }

  /**
   * 提取页面末尾「未结束的句子片段」，用于跨页续接。
   * 页面以真句末标点（。！？，可带闭合引号/括号）收尾 → 句子完整，返回空串；
   * 否则返回最后一个句号之后的文字（可能是一个被拦腰截断的词/句）。
   */
  private extractDanglingTail(text: string): string {
    if (/[。！？][”』」》〉）)\]】]*$/.test(text)) return '';
    const lastEnd = Math.max(
      text.lastIndexOf('。'),
      text.lastIndexOf('！'),
      text.lastIndexOf('？'),
    );
    if (lastEnd < 0) return text;
    const tail = text.slice(lastEnd + 1);
    return /^[”』」》〉）)\]】\s]*$/.test(tail) ? '' : tail;
  }

  /**
   * 递归字符分割：每次取文本中出现过的、优先级最高的分隔符切分；
   * 切出的片段若仍超过 chunkSize，则用更低优先级的分隔符递归切分；
   * 分隔符全部用尽仍无法拆小时，按 chunkSize 硬切兜底。
   * 返回的每个片段长度 <= chunkSize，且尽量是一个完整的句子/段落。
   */
  private splitIntoPieces(
    text: string,
    separators: string[],
    chunkSize: number,
  ): string[] {
    const sepIndex = separators.findIndex((s) => s !== '' && text.includes(s));

    // 没有可用分隔符，只能硬切兜底
    if (sepIndex < 0) return this.hardSlice(text, chunkSize);

    const separator = separators[sepIndex];
    const restSeparators = separators.slice(sepIndex + 1);
    const pieces: string[] = [];
    const rawParts = text.split(separator);

    for (let i = 0; i < rawParts.length; i++) {
      // 把分隔符粘回片段末尾，保证合并后文字连贯（最后一个片段可能没有分隔符）
      const part = rawParts[i];
      const piece = i < rawParts.length - 1 ? part + separator : part;
      if (!piece) continue;

      if (piece.length <= chunkSize) {
        pieces.push(piece);
      } else if (restSeparators.length > 0) {
        pieces.push(...this.splitIntoPieces(piece, restSeparators, chunkSize));
      } else {
        pieces.push(...this.hardSlice(piece, chunkSize));
      }
    }
    return pieces;
  }

  /** 兜底硬切：没有分隔符可依时，按 chunkSize 平均切分 */
  private hardSlice(text: string, chunkSize: number): string[] {
    const pieces: string[] = [];
    for (let i = 0; i < text.length; i += chunkSize) {
      const piece = text.slice(i, i + chunkSize);
      if (piece) pieces.push(piece);
    }
    return pieces;
  }

  /**
   * 把片段合并为 chunk（尽量接近 chunkSize；受 overlap 影响最长 chunkSize + overlap）。
   * 当一个片段放不进当前 chunk 时：先落当前 chunk，再用上一 chunk 尾部
   * （最多 overlap 字符，且尽量从完整句子/段落开始）作为下一 chunk 的开头，
   * 从而让相邻 chunk 之间存在真实重叠。
   */
  private mergeWithOverlap(
    pieces: string[],
    chunkSize: number,
    overlap: number,
    separators: string[],
  ): string[] {
    const chunks: string[] = [];
    let current = '';

    for (const piece of pieces) {
      if (current && current.length + piece.length > chunkSize) {
        chunks.push(current);
        current = this.buildOverlapPrefix(current, overlap, separators);
      }
      current += piece;
    }
    if (current) chunks.push(current);
    return chunks;
  }

  /**
   * 从上一 chunk 尾部截取 overlap 窗口，并尽量回退到窗口内最近的句末/段落分隔符之后，
   * 让重叠文字从完整句子/段落开始（而不是半句/半词）。
   * 窗口内找不到「其后还有实质内容」的分隔符时，直接用整个窗口（保留尾部换行，维持段落边界）。
   */
  private buildOverlapPrefix(
    prevChunk: string,
    overlap: number,
    separators: string[],
  ): string {
    if (overlap <= 0 || !prevChunk) return '';
    const window = prevChunk.slice(-overlap);
    if (!window.trim()) return '';

    // 从窗口末尾向前找最近一个「其后还有实质内容」的分隔符
    for (let i = window.length - 1; i >= 0; i--) {
      for (const sep of separators) {
        if (!sep) continue;
        if (window.startsWith(sep, i)) {
          const after = window.slice(i + sep.length);
          if (after.trim()) return after;
        }
      }
    }
    return window;
  }
}
