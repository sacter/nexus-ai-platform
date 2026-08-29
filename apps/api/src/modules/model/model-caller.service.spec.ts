import { NotFoundException } from '@nestjs/common';
import { PrismaService } from '@nexus/database';
import { ApiKeyService } from '../api-key/api-key.service';
import { ModelCallerService } from './model-caller.service';
import { OpenAiCompatibleChatClient } from '@nexus/ai-core';

/** mock 出 model-caller 需要的 prisma.model.findUnique 返回行（含 include 的 apiKey） */
function mockModel(overrides: Record<string, unknown> = {}) {
  return {
    id: 'model-1',
    provider: 'deepseek',
    modelName: 'deepseek-chat',
    type: 'chat',
    displayName: 'DeepSeek Chat',
    description: null,
    apiKeyId: 'key-1',
    config: { temperature: 0.5, maxTokens: 128 },
    isActive: true,
    createdBy: 'user-1',
    createdAt: new Date(),
    updatedAt: new Date(),
    apiKey: { baseUrl: 'https://api.deepseek.com/v1' },
    ...overrides,
  };
}

describe('ModelCallerService', () => {
  let service: ModelCallerService;
  let prisma: { model: { findUnique: jest.Mock } };
  let apiKeyService: { decryptSecret: jest.Mock };

  const originalOpenAiBaseUrl = process.env.OPENAI_BASE_URL;

  beforeEach(() => {
    prisma = { model: { findUnique: jest.fn() } };
    apiKeyService = { decryptSecret: jest.fn() };
    service = new ModelCallerService(
      prisma as unknown as PrismaService,
      apiKeyService as unknown as ApiKeyService,
    );
    apiKeyService.decryptSecret.mockResolvedValue('sk-test');
  });

  afterEach(() => {
    process.env.OPENAI_BASE_URL = originalOpenAiBaseUrl;
    jest.restoreAllMocks();
  });

  it('有 apiKeyId：解密明文、baseUrl 取凭证、baseConfig 拆出大众化参数', async () => {
    prisma.model.findUnique.mockResolvedValue(mockModel());

    const resolved = await service.resolveChatModel('model-1');

    expect(apiKeyService.decryptSecret).toHaveBeenCalledWith('key-1');
    expect(resolved.modelName).toBe('deepseek-chat');
    expect(resolved.baseConfig).toEqual({ temperature: 0.5, maxTokens: 128 });
    expect(resolved.client).toBeInstanceOf(OpenAiCompatibleChatClient);
    expect(resolved.client.protocol).toBe('openai-compatible');

    // ★ 返回里不含 vendorParams（特殊参数由调用方在调用时传入，不走解析链）
    expect('vendorParams' in resolved).toBe(false);
    expect('vendorParams' in resolved.baseConfig).toBe(false);
  });

  it('config.protocol=ollama-native → 分派原生 client', async () => {
    prisma.model.findUnique.mockResolvedValue(
      mockModel({ config: { protocol: 'ollama-native' } }),
    );

    const resolved = await service.resolveChatModel('model-1');

    expect(resolved.client.protocol).toBe('ollama-native');
  });

  it('无 apiKeyId：不解密，baseUrl 回退环境变量，baseConfig 不取非数字字段', async () => {
    prisma.model.findUnique.mockResolvedValue(
      mockModel({
        apiKeyId: null,
        apiKey: null,
        config: { temperature: '0.5', maxTokens: 256 },
      }),
    );
    process.env.OPENAI_BASE_URL = 'https://env-default.example.com/v1';

    const resolved = await service.resolveChatModel('model-1');

    expect(apiKeyService.decryptSecret).not.toHaveBeenCalled();
    expect(resolved.baseConfig).toEqual({ maxTokens: 256 }); // temperature 非数字被忽略
  });

  it('模型不存在 → NotFoundException', async () => {
    prisma.model.findUnique.mockResolvedValue(null);

    await expect(service.resolveChatModel('model-1')).rejects.toThrow(
      NotFoundException,
    );
  });

  it('非对话模型 → NotFoundException', async () => {
    prisma.model.findUnique.mockResolvedValue(mockModel({ type: 'embedding' }));

    await expect(service.resolveChatModel('model-1')).rejects.toThrow(
      NotFoundException,
    );
  });
});
