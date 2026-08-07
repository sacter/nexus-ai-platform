import { TextSplitter } from './text-splitter';
import { createHash } from 'crypto';

describe('TextSplitter', () => {
  it('超过 chunkSize 的文本按大小切分', () => {
    const splitter = new TextSplitter();
    const chunks = splitter.split(
      [{ pageNumber: 1, content: 'a'.repeat(500) }],
      { chunkSize: 100, chunkOverlap: 0 },
    );
    expect(chunks).toHaveLength(5);
    expect(chunks[0].page).toBe(1);
    expect(chunks[0].chunkIndex).toBe(0);
  });

  it('chunkOverlap 使相邻 chunk 有重叠', () => {
    const splitter = new TextSplitter();
    const chunks = splitter.split(
      [{ pageNumber: 1, content: 'b'.repeat(300) }],
      { chunkSize: 100, chunkOverlap: 20 },
    );
    expect(chunks[1].content).toContain('b'.repeat(20));
  });

  it('contentHash 为内容 sha256', () => {
    const splitter = new TextSplitter();
    const chunks = splitter.split([{ pageNumber: 1, content: 'hello' }], { chunkSize: 100 });
    expect(chunks[0].contentHash).toBe(createHash('sha256').update('hello').digest('hex'));
  });
});
