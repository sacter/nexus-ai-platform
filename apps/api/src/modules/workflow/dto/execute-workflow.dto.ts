import { IsString, IsOptional, IsArray, IsObject } from 'class-validator';

export class ExecuteWorkflowDto {
  @IsString()
  question!: string;

  @IsOptional()
  @IsArray()
  @IsObject({ each: true })
  chatHistory?: { role: 'user' | 'assistant' | 'system'; content: string }[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  kbIds?: string[];

  @IsOptional()
  @IsString()
  modelId?: string;
}
