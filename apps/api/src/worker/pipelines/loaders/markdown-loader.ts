import { Loader, LoadedPage } from './loader.interface';

/**
 * Markdown Loader —— 按二级标题(#/##)切分为语义段落
 * 作为 TextLoader 的增强，先于 TextLoader 匹配
 */
export class MarkdownLoader implements Loader {
  supports(mimeType: string, fileName?: string): boolean {
    return mimeType.includes('markdown') || (fileName ?? '').toLowerCase().endsWith('.md');
  }

  async load(buffer: Buffer): Promise<LoadedPage[]> {
    const raw = buffer.toString('utf-8');
    const sections = raw.split(/(?=^#{1,2} )/m).filter((s) => s.trim().length > 0);
    const chunks = sections.length > 0 ? sections : [raw];
    return chunks.map((content, i) => ({
      pageNumber: i + 1,
      content,
      metadata: { source: 'markdown' },
    }));
  }
}
