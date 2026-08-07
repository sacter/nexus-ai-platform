import { OllamaEmbeddingProvider } from './ollama-embedding.provider';

describe('OllamaEmbeddingProvider', () => {
  it('调用 /api/embed 并返回 embeddings 数组', async () => {
    const mockFetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ embeddings: [[0.1, 0.2], [0.3, 0.4]] }),
    });
    global.fetch = mockFetch as never;

    const provider = new OllamaEmbeddingProvider({
      baseUrl: 'http://ollama:11434',
      model: 'bge-m3',
      dimension: 2,
    });

    const vectors = await provider.embed(['a', 'b']);
    expect(vectors).toEqual([[0.1, 0.2], [0.3, 0.4]]);
    expect(mockFetch).toHaveBeenCalledWith(
      'http://ollama:11434/api/embed',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ model: 'bge-m3', input: ['a', 'b'] }),
      }),
    );
  });

  it('非 2xx 响应抛出异常', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 500 }) as never;
    const provider = new OllamaEmbeddingProvider({ baseUrl: 'http://x', model: 'm', dimension: 2 });
    await expect(provider.embed(['a'])).rejects.toThrow('500');
  });
});
