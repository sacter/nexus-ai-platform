import { LoadedPage } from '../loaders/loader.interface';

/** 解析结果：结构化文本 + 元数据 */
export interface ParsedDocument {
  pages: Array<{
    pageNumber: number;
    content: string;
    metadata?: Record<string, unknown>;
  }>;
  totalPages: number;
  summary?: string;
}

export interface DocumentParser {
  parse(pages: LoadedPage[]): Promise<ParsedDocument>;
}
