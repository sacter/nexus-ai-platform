import pdfParse from 'pdf-parse';
import { Loader, LoadedPage } from './loader.interface';

const PDF_MIME = 'application/pdf';

/** PDF Loader —— 基于 pdf-parse，按 \f 分页符拆页 */
export class PdfLoader implements Loader {
  supports(mimeType: string, fileName?: string): boolean {
    return mimeType === PDF_MIME || (fileName ?? '').toLowerCase().endsWith('.pdf');
  }

  async load(buffer: Buffer): Promise<LoadedPage[]> {
    const { text } = await pdfParse(buffer);
    const rawPages = text.split('\f').map((s) => s.trim()).filter((s) => s.length > 0);
    const pages = rawPages.length > 0 ? rawPages : [text.trim()];
    return pages.map((content, i) => ({
      pageNumber: i + 1,
      content,
      metadata: { source: 'pdf' },
    }));
  }
}
