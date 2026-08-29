import {
  IsString,
  MaxLength,
  IsNotEmpty,
  IsOptional,
  IsArray,
} from 'class-validator';

export class CreateSessionDto {
  @IsString()
  @IsOptional()
  kbId?: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(512)
  title!: string;

  @IsString()
  @IsOptional()
  promptTemplateId?: string;

  @IsString()
  @IsOptional()
  aiApplicationId?: string;

  @IsString()
  @IsOptional()
  modelId?: string;

  @IsArray()
  @IsOptional()
  @IsString({ each: true })
  toolIds?: string[];

  @IsString()
  @IsOptional()
  workflowId?: string;
}
