import { TextParser } from './text-parser';

describe('TextParser', () => {
  it('清洗空白并统计总页数', async () => {
    const parser = new TextParser();
    const result = await parser.parse([
      { pageNumber: 1, content: '  hello   world  ' },
      { pageNumber: 2, content: '\nsecond\n' },
    ]);
    expect(result.totalPages).toBe(2);
    expect(result.pages[0].content).toBe('hello world');
    expect(result.pages[1].content).toBe('second');
  });
});
