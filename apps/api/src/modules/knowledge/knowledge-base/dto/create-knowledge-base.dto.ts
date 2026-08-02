import {
  IsString,
  MinLength,
  MaxLength,
  IsOptional,
  IsNotEmpty,
} from 'class-validator';

export class CreateKnowledgeBaseDto {
  @IsString()
  @MinLength(1)
  @MaxLength(256)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(4096)
  description?: string;

  @IsNotEmpty()
  @IsString()
  embeddingModel!: string;

  @IsNotEmpty()
  @IsString()
  retrievalStrategy!: 'vector' | 'hybrid';
}
