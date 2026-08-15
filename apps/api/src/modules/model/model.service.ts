import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '@nexus/database';
import { MODEL_CONFIG_LIMITS } from '@nexus/model-config';
import { ModelType, Prisma } from '@prisma/client';
import { CreateModelDto } from './dto/create-model.dto';
import { UpdateModelDto } from './dto/update-model.dto';

/** 列表/详情联查凭证名称（前端 Model.apiKeyName 契约） */
const MODEL_INCLUDE = {
  apiKey: { select: { name: true } },
} as const;

type ModelWithApiKey = Prisma.ModelGetPayload<{
  include: typeof MODEL_INCLUDE;
}>;

/** 对外返回结构：apiKey 嵌套对象扁平化为 apiKeyName */
type ModelPublic = Omit<ModelWithApiKey, 'apiKey'> & {
  apiKeyName: string | null;
};

/** findAll 可选过滤条件 */
export interface ModelFilters {
  type?: ModelType;
  provider?: string;
  isActive?: boolean;
}

@Injectable()
export class ModelService {
  constructor(private readonly prisma: PrismaService) {}

  async create(
    createModelDto: CreateModelDto,
    userId: string,
  ): Promise<ModelPublic> {
    this.validateConfig(createModelDto.type, createModelDto.config);
    await this.assertProviderMatches(
      createModelDto.provider,
      createModelDto.apiKeyId,
    );

    try {
      const row = await this.prisma.model.create({
        data: {
          ...createModelDto,
          config: createModelDto.config as Prisma.InputJsonObject,
          createdBy: userId,
        },
        include: MODEL_INCLUDE,
      });
      return this.toPublic(row);
    } catch (e) {
      this.throwKnown(e, `该 Provider 下已存在同名模型`);
    }
  }

  async findAll(filters: ModelFilters = {}): Promise<ModelPublic[]> {
    const where: Prisma.ModelWhereInput = {};
    if (filters.type) where.type = filters.type;
    if (filters.provider) where.provider = filters.provider;
    if (filters.isActive !== undefined) where.isActive = filters.isActive;

    const rows = await this.prisma.model.findMany({
      where,
      include: MODEL_INCLUDE,
      orderBy: { createdAt: 'desc' },
    });
    return rows.map((row) => this.toPublic(row));
  }

  /** 不存在返回 null（与 api-key 模块一致） */
  async findOne(id: string): Promise<ModelPublic | null> {
    const row = await this.prisma.model.findUnique({
      where: { id },
      include: MODEL_INCLUDE,
    });
    return row ? this.toPublic(row) : null;
  }

  async update(
    id: string,
    updateModelDto: UpdateModelDto,
  ): Promise<ModelPublic> {
    const existing = await this.prisma.model.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('模型不存在');

    // 合并新旧值后做一致性校验，避免只改 provider 或只改 apiKeyId 时绕过
    const nextProvider = updateModelDto.provider ?? existing.provider;
    const nextType = updateModelDto.type ?? existing.type;
    const nextApiKeyId =
      updateModelDto.apiKeyId !== undefined
        ? updateModelDto.apiKeyId
        : existing.apiKeyId;
    if (updateModelDto.config)
      this.validateConfig(nextType, updateModelDto.config);
    await this.assertProviderMatches(nextProvider, nextApiKeyId);

    try {
      const row = await this.prisma.model.update({
        where: { id },
        data: {
          ...updateModelDto,
          config: updateModelDto.config as Prisma.InputJsonObject | undefined,
        },
        include: MODEL_INCLUDE,
      });
      return this.toPublic(row);
    } catch (e) {
      this.throwKnown(e, `该 Provider 下已存在同名模型`);
    }
  }

  async remove(id: string): Promise<{ id: string }> {
    try {
      await this.prisma.model.delete({ where: { id } });
      return { id };
    } catch (e) {
      // P2025: 目标不存在；P2003: 被 AiApplication 以 Restrict 引用
      if (this.prismaErrorCode(e) === 'P2025')
        throw new NotFoundException('模型不存在');
      if (this.prismaErrorCode(e) === 'P2003') {
        throw new ConflictException('模型已被应用引用，无法删除');
      }
      throw e;
    }
  }

  /** apiKeyId 存在时校验凭证存在且 Provider 一致（models.api_key_id → api_keys） */
  private async assertProviderMatches(
    provider: string,
    apiKeyId?: string | null,
  ) {
    if (!apiKeyId) return;
    const key = await this.prisma.apiKey.findUnique({
      where: { id: apiKeyId },
      select: { provider: true },
    });
    if (!key) throw new BadRequestException('关联的 API Key 不存在');
    if (key.provider !== provider) {
      throw new BadRequestException(
        `凭证 (${key.provider}) 与模型 Provider (${provider}) 不一致`,
      );
    }
  }

  /** 按类型校验 config 能力参数范围（边界取 @nexus/model-config 单一来源，见 DATABASE.md 4.20） */
  private validateConfig(type: ModelType, config: Record<string, unknown>) {
    const num = (v: unknown): v is number =>
      typeof v === 'number' && !Number.isNaN(v);
    const range = (
      v: unknown,
      bound: { min: number; max: number },
      label: string,
    ) => {
      if (!num(v) || v < bound.min || v > bound.max) {
        throw new BadRequestException(
          `${label} 需在 ${bound.min} ~ ${bound.max} 之间`,
        );
      }
    };

    if (type === 'chat') {
      const limits = MODEL_CONFIG_LIMITS.chat;
      if ('maxTokens' in config)
        range(config.maxTokens, limits.maxTokens, 'maxTokens');
      if ('temperature' in config)
        range(config.temperature, limits.temperature, 'temperature');
      for (const k of ['supportsVision', 'supportsTools'] as const) {
        if (k in config && typeof config[k] !== 'boolean') {
          throw new BadRequestException(`${k} 必须为布尔值`);
        }
      }
    } else if (type === 'embedding') {
      const limits = MODEL_CONFIG_LIMITS.embedding;
      if ('dimension' in config)
        range(config.dimension, limits.dimension, '向量维度');
      if ('maxBatchSize' in config)
        range(config.maxBatchSize, limits.maxBatchSize, 'maxBatchSize');
    } else if (type === 'rerank') {
      const limits = MODEL_CONFIG_LIMITS.rerank;
      if ('maxBatchSize' in config)
        range(config.maxBatchSize, limits.maxBatchSize, 'maxBatchSize');
    }
  }

  /** P2002（唯一冲突）/ P2025（不存在）转成友好异常，其余原样抛出 */
  private throwKnown(e: unknown, duplicateMessage: string): never {
    const code = this.prismaErrorCode(e);
    if (code === 'P2002') throw new ConflictException(duplicateMessage);
    if (code === 'P2025') throw new NotFoundException('模型不存在');
    throw e;
  }

  private prismaErrorCode(e: unknown): string | undefined {
    if (e instanceof Prisma.PrismaClientKnownRequestError) return e.code;
    if (e && typeof e === 'object' && 'code' in e) {
      return (e as { code?: unknown }).code as string | undefined;
    }
    return undefined;
  }

  private toPublic(row: ModelWithApiKey): ModelPublic {
    const { apiKey, ...rest } = row;
    return { ...rest, apiKeyName: apiKey?.name ?? null };
  }
}
