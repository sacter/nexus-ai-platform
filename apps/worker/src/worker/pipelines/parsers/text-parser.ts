import { LoadedPage } from '../loaders/loader.interface';
import { DocumentParser, ParsedDocument } from './parser.interface';
import { preprocessText } from '../text-utils';

/**
 * 文本解析器 —— 折行重排、空白归一化、去空页、生成摘要
 *
 * 注意：这里不能把 \s+ 折叠成空格，否则会把 PDF 抽取结果中的段落换行（\n\n / \n）
 * 全部抹平，导致后续 Splitter 只能从句子中间拦腰截断。preprocessText 会先把折行
 * 重排回完整句子/段落，再保留 \n\n 段落结构。
 */
export class TextParser implements DocumentParser {
  // eslint-disable-next-line @typescript-eslint/require-await
  async parse(pages: LoadedPage[]): Promise<ParsedDocument> {
    const cleaned = pages
      .map((p) => ({
        pageNumber: p.pageNumber,
        content: preprocessText(p.content),
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
