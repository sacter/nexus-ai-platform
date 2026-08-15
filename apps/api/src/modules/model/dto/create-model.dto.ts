import {
  IsEnum,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';
import { ModelType } from '@prisma/client';

/** 宽松 UUID 形状校验：种子/历史数据版本位可能不规范，仅约束格式 */
const UUID_REGEX =
  /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

export class CreateModelDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  provider!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  modelName!: string;

  @IsEnum(ModelType)
  type!: ModelType;

  @IsString()
  @IsNotEmpty()
  @MaxLength(256)
  displayName!: string;

  @IsOptional()
  @IsString()
  @MaxLength(4096)
  description?: string | null;

  /** 关联 api_keys 凭证 id；不传 / null = 使用环境变量默认 */
  @IsOptional()
  @IsString()
  @Matches(UUID_REGEX)
  apiKeyId?: string | null;

  /** 按 type 结构不同，如 chat: {maxTokens, temperature, supportsVision, supportsTools} */
  @IsObject()
  config!: Record<string, unknown>;
}
