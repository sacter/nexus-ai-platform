import {
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

/**
 * 创建提示词模板：正文必填，服务端据此创建 v1 并抽取 {{variables}}。
 * currentVersionId 为服务端管理指针，不接受客户端传入。
 */
export class CreatePromptTemplateDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(256)
  name!: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsString()
  @IsNotEmpty()
  content!: string;
}
