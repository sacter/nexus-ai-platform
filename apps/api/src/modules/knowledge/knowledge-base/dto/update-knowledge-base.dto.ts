import { PartialType } from '@nestjs/mapped-types';
import { IsBoolean, IsOptional } from 'class-validator';
import { CreateKnowledgeBaseDto } from './create-knowledge-base.dto';

export class UpdateKnowledgeBaseDto extends PartialType(
  CreateKnowledgeBaseDto,
) {
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
