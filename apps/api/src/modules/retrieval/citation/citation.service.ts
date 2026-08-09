import { Injectable } from '@nestjs/common';
import { Citation } from '../dto/search.dto';

export interface CitationInput {
  documentName: string;
  page: number;
  versionNumber: number;
  content: string;
}

@Injectable()
export class CitationService {
  /**
   * 从切片元数据构建引用对象
   *
   * snippet：取内容前 200 字符作为预览摘要
   * version：格式化为 "v{versionNumber}"
   */
  buildCitation(input: CitationInput): Citation {
    const snippet =
      input.content.length > 200
        ? input.content.substring(0, 200) + '...'
        : input.content;

    return {
      documentName: input.documentName,
      page: input.page,
      version: `v${input.versionNumber}`,
      snippet,
    };
  }

  buildCitations(inputs: CitationInput[]): Citation[] {
    return inputs.map((input) => this.buildCitation(input));
  }
}
