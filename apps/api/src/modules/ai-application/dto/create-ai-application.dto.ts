import {
  IsNotEmpty,
  IsString,
  IsObject,
  MaxLength,
  IsOptional,
} from 'class-validator';

export class CreateAiApplicationDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(256)
  name!: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsString()
  @IsNotEmpty()
  icon!: string;

  @IsString()
  @IsNotEmpty()
  knowledgeBaseId!: string;

  @IsString()
  @IsNotEmpty()
  workflowId!: string;

  @IsString()
  @IsNotEmpty()
  modelId!: string;

  @IsString()
  @IsOptional()
  promptTemplateId?: string;

  @IsString()
  @IsNotEmpty()
  status!: string;

  @IsObject()
  @IsNotEmpty()
  config!: Record<string, unknown>;
}
