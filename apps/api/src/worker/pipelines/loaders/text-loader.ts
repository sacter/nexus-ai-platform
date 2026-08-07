import { Loader, LoadedPage } from './loader.interface';

const TEXT_MIME = ['text/plain', 'text/markdown', 'text/x-markdown'];

/** 纯文本 Loader（txt / md / 其他纯文本兜底） */
export class TextLoader implements Loader {
  supports(mimeType: string, fileName?: string): boolean {
    const ext = (fileName ?? '').toLowerCase();
    return (
      TEXT_MIME.includes(mimeType) ||
      ext.endsWith('.txt') ||
      ext.endsWith('.md')
    );
  }

  load(buffer: Buffer): Promise<LoadedPage[]> {
    return [{ pageNumber: 1, content: buffer.toString('utf-8') }];
  }
}
