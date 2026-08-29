import {
  IsArray,
  IsEnum,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { ApplicationStatus } from '@prisma/client';

export class CreateAiApplicationDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(256)
  name!: string;

  @IsString()
  @IsOptional()
  description?: string;

  /** 图标标识（前端按 key 渲染）；缺省 'bot' */
  @IsString()
  @IsOptional()
  icon?: string;

  @IsString()
  @IsNotEmpty()
  knowledgeBaseId!: string;

  @IsString()
  @IsNotEmpty()
  workflowId!: string;

  @IsString()
  @IsNotEmpty()
  modelId!: string;

  /** 不绑定 = 使用系统默认 Prompt；null 显式解除绑定（PATCH 时） */
  @IsString()
  @IsOptional()
  promptTemplateId?: string | null;

  /** 发布状态；缺省 draft */
  @IsEnum(ApplicationStatus)
  @IsOptional()
  status?: ApplicationStatus;

  /** 运行配置（temperature/maxTokens/welcomeMessage/suggestedQuestions）；缺省 {} */
  @IsObject()
  @IsOptional()
  config?: Record<string, unknown>;

  /** 创建时一次性绑定工具；与 POST /:id/tools 等价 */
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  toolIds?: string[];
}
