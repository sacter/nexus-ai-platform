import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@nexus/database';
import { ApiKeyService } from '../api-key/api-key.service';
import { ChatProtocol, ChatProvider, createChatProvider } from '@nexus/ai-core';

/** 解析结果：client 可直接调用；baseConfig 为 DB 拆出的大众化参数 */
export interface ResolvedChatModel {
  client: ChatProvider;
  modelName: string;
  baseConfig: { temperature?: number; maxTokens?: number };
}

/**
 * 「模型 → 凭证 → 协议参数」解析链（谁使用谁负责）。
 *
 * 放置原则：DB 查询（models/api_keys）、密钥解密、参数组装属 API 进程职责，放这里；
 * ai-core 只提供纯协议 client（不感知 DB）。
 *
 * ★ 不含 vendorParams——模型/厂商特有参数（如 DeepSeek enable_thinking）由
 * 调用方在调用时传入，DB 只存大众化参数（temperature/maxTokens）。
 */
@Injectable()
export class ModelCallerService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly apiKeyService: ApiKeyService,
  ) {}

  async resolveChatModel(modelId: string): Promise<ResolvedChatModel> {
    const model = await this.prisma.model.findUnique({
      where: { id: modelId },
      include: { apiKey: { select: { baseUrl: true } } },
    });
    if (!model) throw new NotFoundException('模型不存在');
    if (model.type !== 'chat')
      throw new NotFoundException('该模型不是对话模型');

    // 凭证：有 apiKeyId → 进程内解密明文（仅服务端内存，绝不外泄）；无 → 无鉴权调用（本地模型）
    const apiKey = model.apiKeyId
      ? await this.apiKeyService.decryptSecret(model.apiKeyId)
      : undefined;

    // baseUrl 来自凭证（models.api_key.base_url）；无凭证时回退环境变量
    const baseUrl =
      model.apiKey?.baseUrl ??
      process.env.OPENAI_BASE_URL ??
      'https://api.openai.com/v1';

    const config = (model.config ?? {}) as Record<string, unknown>;
    // 只拆大众化参数，不展开未知字段（vendorParams 不落 DB）
    const baseConfig: { temperature?: number; maxTokens?: number } = {};
    if (typeof config.temperature === 'number') {
      baseConfig.temperature = config.temperature;
    }
    if (typeof config.maxTokens === 'number') {
      baseConfig.maxTokens = config.maxTokens;
    }

    return {
      client: createChatProvider({
        protocol: this.resolveProtocol(config),
        baseUrl,
        apiKey,
      }),
      modelName: model.modelName,
      baseConfig,
    };
  }

  /** 协议由 DB 数据驱动；缺省一律 openai-compatible（Ollama 通常也暴露兼容端点，确需原生才在 config 标 ollama-native） */
  private resolveProtocol(config: Record<string, unknown>): ChatProtocol {
    return config.protocol === 'ollama-native'
      ? 'ollama-native'
      : 'openai-compatible';
  }
}
