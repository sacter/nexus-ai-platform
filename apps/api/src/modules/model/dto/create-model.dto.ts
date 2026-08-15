import { IsNotEmpty, IsString, IsJSON, MaxLength } from 'class-validator';

export class CreateModelDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  provider!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  modelName!: string;

  @IsString()
  @IsNotEmpty()
  type!: 'chat' | 'embedding' | 'rerank';

  @IsString()
  @IsNotEmpty()
  @MaxLength(256)
  displayName!: string;

  @IsString()
  @MaxLength(4096)
  description?: string;

  @IsString()
  @IsNotEmpty()
  apiKeyId!: string;

  @IsJSON()
  @IsNotEmpty()
  config!: Record<string, any>;
}
