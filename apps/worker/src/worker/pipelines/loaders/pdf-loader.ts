import { PDFParse } from 'pdf-parse';
import { Loader, LoadedPage } from './loader.interface';

const PDF_MIME = 'application/pdf';

/** PDF Loader —— 基于 pdf-parse 2.x，按页提取文本 */
export class PdfLoader implements Loader {
  supports(mimeType: string, fileName?: string): boolean {
    return (
      mimeType === PDF_MIME || (fileName ?? '').toLowerCase().endsWith('.pdf')
    );
  }

  async load(buffer: Buffer<ArrayBufferLike>): Promise<LoadedPage[]> {
    const parser = new PDFParse({ data: buffer });
    try {
      const result = await parser.getText();
      const pages = result.pages
        .map((p) => ({ pageNumber: p.num, content: p.text.trim() }))
        .filter((p) => p.content.length > 0);
      const list =
        pages.length > 0
          ? pages
          : [{ pageNumber: 1, content: result.text.trim() }];
      return list
        .filter((p) => p.content.length > 0)
        .map((p) => ({ ...p, metadata: { source: 'pdf' } }));
    } finally {
      await parser.destroy();
    }
  }
}
