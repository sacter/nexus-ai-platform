import { IsNotEmpty, IsString, MaxLength, IsOptional } from 'class-validator';

export class CreatePromptTemplateDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(256)
  name!: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsString()
  @IsOptional()
  currentVersionId?: string;
}
