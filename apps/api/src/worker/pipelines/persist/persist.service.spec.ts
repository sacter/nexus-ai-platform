import { PersistService } from './persist.service';
import { SplitChunk } from '../splitters/splitter.interface';

describe('PersistService', () => {
  const prismaMock = {
    documentChunk: {
      createMany: jest.fn(),
      findMany: jest.fn(),
      deleteMany: jest.fn(),
    },
    $executeRaw: jest.fn(),
  };

  it('saveChunks 调用 createMany 批量写入', async () => {
    prismaMock.documentChunk.createMany.mockResolvedValue({ count: 2 });
    prismaMock.documentChunk.findMany.mockResolvedValue([]);
    const service = new PersistService(prismaMock as never);
    const chunks: SplitChunk[] = [
      { page: 1, chunkIndex: 0, content: 'a', contentHash: 'h1', tokenCount: 1 },
      { page: 1, chunkIndex: 1, content: 'b', contentHash: 'h2', tokenCount: 1 },
    ];
    const result = await service.saveChunks('v1', chunks);
    expect(result.count).toBe(2);
    expect(prismaMock.documentChunk.createMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.any(Array) }),
    );
  });

  it('saveEmbedding 使用原生 SQL 写入 vector', async () => {
    prismaMock.$executeRaw.mockResolvedValue(1);
    const service = new PersistService(prismaMock as never);
    await service.saveEmbedding('chunk1', 'kb1', 'bge-m3', [0.1, 0.2]);
    expect(prismaMock.$executeRaw).toHaveBeenCalled();
  });
});
