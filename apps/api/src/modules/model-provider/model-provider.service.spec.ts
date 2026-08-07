import { ModelProviderService } from './model-provider.service';

describe('ModelProviderService', () => {
  let service: ModelProviderService;

  beforeEach(() => {
    service = new ModelProviderService();
  });

  it('已知模型名解析出 provider 与 dimension', () => {
    const cfg = service.resolveEmbeddingConfig('bge-m3');
    expect(cfg.provider).toBe('ollama');
    expect(cfg.dimension).toBe(1024);
  });

  it('支持 provider/model 显式格式', () => {
    const cfg = service.resolveEmbeddingConfig('openai/text-embedding-3-small');
    expect(cfg.provider).toBe('openai');
    expect(cfg.dimension).toBe(1536);
  });

  it('未知模型回退到 provider=ollama 且 dimension 用默认', () => {
    const cfg = service.resolveEmbeddingConfig('my-custom-model');
    expect(cfg.provider).toBe('ollama');
    expect(cfg.model).toBe('my-custom-model');
  });

  it('未传模型时使用环境默认', () => {
    const cfg = service.resolveEmbeddingConfig();
    expect(cfg.model).toBe('bge-m3');
  });
});
