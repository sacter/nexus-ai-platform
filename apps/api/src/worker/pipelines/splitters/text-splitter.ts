import { createHash } from 'crypto';
import {
  SplitChunk,
  SplitOptions,
  TextSplitterPort,
} from './splitter.interface';

/**
 * 文本分割器 —— 字符级近似切分
 * 默认 chunkSize=800 字符（约 200-400 token），overlap=80
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
    const overlap = opts?.chunkOverlap ?? this.defaultOverlap;

    const chunks: SplitChunk[] = [];
    let index = 0;

    for (const page of pages) {
      const text = page.content.replace(/\s+/g, ' ').trim();
      if (!text) continue;

      // 防止 overlap >= chunkSize 时步进为 0 导致死循环
      const step = Math.max(1, chunkSize - overlap);
      for (let start = 0; start < text.length; start += step) {
        const content = text.slice(start, start + chunkSize).trim();
        if (!content) continue;
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
}
