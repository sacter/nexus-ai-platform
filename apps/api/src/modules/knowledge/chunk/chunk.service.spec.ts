import { Test } from '@nestjs/testing';
import { ChunkService } from './chunk.service';
import { PrismaService } from '../../../infrastructure/database/prisma/prisma.service';

describe('ChunkService', () => {
  let service: ChunkService;
  const prisma = {
    document: { findFirst: jest.fn(), findMany: jest.fn() },
    documentChunk: { count: jest.fn(), findMany: jest.fn() },
    chunkEmbedding: { findMany: jest.fn() },
    $transaction: (ops: Promise<unknown>[]) => Promise.all(ops),
  };

  const chunkRow = {
    id: 'c1',
    versionId: 'v1',
    page: 2,
    chunkIndex: 3,
    content: 'hello',
    tokenCount: 5,
    metadata: { title: 'x' },
    parentChunkId: null,
    createdAt: new Date('2026-08-08T00:00:00Z'),
    version: { document: { id: 'doc1', name: '测试文档' } },
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const moduleRef = await Test.createTestingModule({
      providers: [
        ChunkService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();
    service = moduleRef.get(ChunkService);
  });

  it('指定 documentId 但文档不存在/无活跃版本 → 返回空结果', async () => {
    prisma.document.findFirst.mockResolvedValue(null);
    const result = await service.listChunks('kb1', { documentId: 'docX' });
    expect(result).toEqual({ items: [], total: 0, page: 1, pageSize: 20 });
    expect(prisma.documentChunk.findMany).not.toHaveBeenCalled();
  });

  it('知识库内无任何文档 → 返回空结果', async () => {
    prisma.document.findMany.mockResolvedValue([]);
    const result = await service.listChunks('kb1', {});
    expect(result).toEqual({ items: [], total: 0, page: 1, pageSize: 20 });
  });

  it('按 documentId 过滤：只查该文档活跃版本，并附文档名与向量化状态', async () => {
    prisma.document.findFirst.mockResolvedValue({ currentVersionId: 'v1' });
    prisma.documentChunk.count.mockResolvedValue(1);
    prisma.documentChunk.findMany.mockResolvedValue([chunkRow]);
    prisma.chunkEmbedding.findMany.mockResolvedValue([
      { chunkId: 'c1', modelName: 'bge-m3' },
    ]);

    const result = await service.listChunks('kb1', {
      documentId: 'doc1',
      page: 1,
      pageSize: 20,
    });

    expect(prisma.document.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: 'doc1', kbId: 'kb1' }),
      }),
    );
    expect(prisma.documentChunk.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { versionId: { in: ['v1'] } },
        skip: 0,
        take: 20,
      }),
    );
    expect(result.total).toBe(1);
    expect(result.items[0]).toEqual(
      expect.objectContaining({
        documentId: 'doc1',
        documentName: '测试文档',
        page: 2,
        chunkIndex: 3,
        content: 'hello',
        tokenCount: 5,
        isEmbedded: true,
        embeddingModels: ['bge-m3'],
      }),
    );
  });

  it('全部视图：收集所有非删除文档的活跃版本 id，分页并排除无活跃版本的文档', async () => {
    prisma.document.findMany.mockResolvedValue([
      { currentVersionId: 'v1' },
      { currentVersionId: 'v2' },
      { currentVersionId: null },
    ]);
    prisma.documentChunk.count.mockResolvedValue(2);
    prisma.documentChunk.findMany.mockResolvedValue([]);
    prisma.chunkEmbedding.findMany.mockResolvedValue([]);

    const result = await service.listChunks('kb1', { page: 2, pageSize: 10 });

    expect(prisma.document.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ kbId: 'kb1', status: { not: 'DELETED' } }),
      }),
    );
    expect(prisma.documentChunk.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { versionId: { in: ['v1', 'v2'] } },
        skip: 10,
        take: 10,
      }),
    );
    expect(result.total).toBe(2);
    expect(result.page).toBe(2);
    expect(result.pageSize).toBe(10);
  });

  it('无 embedding 记录 → isEmbedded=false 且 embeddingModels 为空', async () => {
    prisma.document.findMany.mockResolvedValue([{ currentVersionId: 'v1' }]);
    prisma.documentChunk.count.mockResolvedValue(1);
    prisma.documentChunk.findMany.mockResolvedValue([chunkRow]);
    prisma.chunkEmbedding.findMany.mockResolvedValue([]);

    const result = await service.listChunks('kb1', {});
    expect(result.items[0].isEmbedded).toBe(false);
    expect(result.items[0].embeddingModels).toEqual([]);
  });

  it('page/pageSize 钳制：page 至少 1，pageSize 上限 100', async () => {
    prisma.document.findMany.mockResolvedValue([{ currentVersionId: 'v1' }]);
    prisma.documentChunk.count.mockResolvedValue(0);
    prisma.documentChunk.findMany.mockResolvedValue([]);
    prisma.chunkEmbedding.findMany.mockResolvedValue([]);

    const result = await service.listChunks('kb1', { page: 0, pageSize: 9999 });
    expect(result.page).toBe(1);
    expect(result.pageSize).toBe(100);
  });
});
