import { IsString, MaxLength, IsNotEmpty, IsOptional } from 'class-validator';

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
  workflowId?: string;
}
