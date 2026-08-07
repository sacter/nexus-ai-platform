import { LoadedPage } from '../loaders/loader.interface';
import { DocumentParser, ParsedDocument } from './parser.interface';

/**
 * 文本解析器 —— 空白归一化、去空页、生成摘要
 */
export class TextParser implements DocumentParser {
  parse(pages: LoadedPage[]): Promise<ParsedDocument> {
    const cleaned = pages
      .map((p) => ({
        pageNumber: p.pageNumber,
        content: p.content.replace(/\s+/g, ' ').trim(),
        metadata: p.metadata,
      }))
      .filter((p) => p.content.length > 0);

    const total = cleaned.reduce((sum, p) => sum + p.content.length, 0);
    return {
      pages: cleaned,
      totalPages: cleaned.length,
      summary: total > 0 ? `共 ${cleaned.length} 页，${total} 字符` : undefined,
    };
  }
}
