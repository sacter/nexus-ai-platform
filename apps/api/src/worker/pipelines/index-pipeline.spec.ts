import { IndexPipeline } from './index-pipeline';

describe('IndexPipeline', () => {
  const prismaMock = {
    document: { findUnique: jest.fn(), update: jest.fn() },
    knowledgeBase: { findUnique: jest.fn() },
    indexJob: { create: jest.fn(), update: jest.fn() },
    documentVersion: {
      findUnique: jest.fn().mockResolvedValue({ id: 'v1', fileUrl: 'obj-key', mimeType: 'application/pdf' }),
      update: jest.fn(),
    },
  };
  const minioMock = { downloadObject: jest.fn() };
  const persistMock = { saveChunks: jest.fn(), saveEmbeddings: jest.fn() };
  const loaderMock = {
    supports: jest.fn(() => true),
    load: jest.fn(async () => [{ pageNumber: 1, content: 'hello worker' }]),
  };
  const splitterMock = { split: jest.fn(() => []) };
  const parserMock = { parse: jest.fn(async (pages: unknown[]) => ({ pages, totalPages: pages.length })) };
  const queueMock = { add: jest.fn() };

  it('完整流水线执行并 enqueue embedding 任务', async () => {
    prismaMock.document.findUnique.mockResolvedValue({
      id: 'd1', kbId: 'kb1', status: 'UPLOADING',
    });
    prismaMock.knowledgeBase.findUnique.mockResolvedValue({ id: 'kb1', embeddingModel: 'bge-m3' });
    prismaMock.indexJob.create.mockResolvedValue({ id: 'job1' });
    prismaMock.document.update.mockResolvedValue({});
    prismaMock.documentVersion.update.mockResolvedValue({});
    minioMock.downloadObject.mockResolvedValue(Buffer.from('x'));
    persistMock.saveChunks.mockResolvedValue({ count: 1, ids: ['chunk1'] });

    const pipeline = new IndexPipeline(
      prismaMock as never, minioMock as never, persistMock as never,
      [loaderMock] as never, splitterMock as never, parserMock as never,
      queueMock as never, { resolveEmbeddingConfig: () => ({ model: 'bge-m3', dimension: 1024, provider: 'ollama', baseUrl: 'x' }) } as never,
    );

    await pipeline.run('d1', 'v1', 'kb1');
    expect(queueMock.add).toHaveBeenCalledWith('embedding', expect.any(String), expect.objectContaining({ documentId: 'd1' }));
    expect(prismaMock.indexJob.update).toHaveBeenCalled();
  });
});
