import { PdfLoader } from './pdf-loader';
import { TextLoader } from './text-loader';

jest.mock('pdf-parse', () => {
  const parse = jest.fn().mockResolvedValue({ text: 'page one\n\fpage two', numpages: 2 });
  (parse as unknown as { test: () => boolean }).test = () => true;
  return parse;
});

describe('PdfLoader', () => {
  it('supports 识别 pdf', () => {
    const loader = new PdfLoader();
    expect(loader.supports('application/pdf', 'a.pdf')).toBe(true);
    expect(loader.supports('text/plain', 'a.txt')).toBe(false);
  });

  it('load 按分页符拆分为多页', async () => {
    const loader = new PdfLoader();
    const pages = await loader.load(Buffer.from('x'), 'application/pdf', 'a.pdf');
    expect(pages).toHaveLength(2);
    expect(pages[0].pageNumber).toBe(1);
    expect(pages[0].content).toBe('page one');
  });
});

describe('TextLoader', () => {
  it('load 返回 utf-8 单页文本', async () => {
    const loader = new TextLoader();
    const pages = await loader.load(Buffer.from('你好', 'utf-8'), 'text/plain', 'a.txt');
    expect(pages).toEqual([{ pageNumber: 1, content: '你好' }]);
  });
});
