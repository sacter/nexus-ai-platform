import { EmbeddingService } from './embedding.service';
import { ModelProviderService } from '../model-provider/model-provider.service';

describe('EmbeddingService', () => {
  const redisMock = { get: jest.fn(), set: jest.fn() };
  const providerMock = {
    resolveEmbeddingConfig: jest.fn().mockReturnValue({
      model: 'bge-m3',
      provider: 'ollama',
      dimension: 3,
      baseUrl: 'http://ollama:11434',
    }),
  };
  let service: EmbeddingService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new EmbeddingService(providerMock as never, redisMock as never);
  });

  it('embedQuery 缓存未命中时调用 provider 并写入 24h 缓存', async () => {
    redisMock.get.mockResolvedValue(null);
    jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ embeddings: [[1, 2, 3]] }),
    } as never);
    const result = await service.embedQuery('请假流程是什么?');
    expect(result.vector).toEqual([1, 2, 3]);
    expect(result.cached).toBe(false);
    expect(result.model).toBe('bge-m3');
    expect(redisMock.set).toHaveBeenCalledWith(
      expect.stringMatching(/^embed:[0-9a-f]{64}:bge-m3$/),
      '[1,2,3]',
      86400,
    );
  });

  it('embedQuery 缓存命中时直接返回缓存向量，不调用 provider', async () => {
    redisMock.get.mockResolvedValue('[9,9,9]');
    jest.spyOn(global, 'fetch');
    const result = await service.embedQuery('x');
    expect(result.vector).toEqual([9, 9, 9]);
    expect(result.cached).toBe(true);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('embedChunks 批量向量化返回向量数组', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ embeddings: [[1, 2, 3], [4, 5, 6]] }),
    } as never);
    const vectors = await service.embedChunks(['a', 'b']);
    expect(vectors).toEqual([[1, 2, 3], [4, 5, 6]]);
  });
});
