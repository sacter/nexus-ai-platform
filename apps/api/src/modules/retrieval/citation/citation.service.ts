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
   * Build a citation object from chunk metadata.
   *
   * Snippet: first ~200 characters of content for preview.
   * Version: formatted as "v{versionNumber}".
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
