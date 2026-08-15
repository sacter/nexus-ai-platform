import { PartialType } from '@nestjs/mapped-types';
import { IsBoolean, IsOptional } from 'class-validator';
import { CreateModelDto } from './create-model.dto';

export class UpdateModelDto extends PartialType(CreateModelDto) {
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
