import { PartialType } from '@nestjs/mapped-types';
import { CreateWorkflowDto } from './create-workflow.dto';
import { IsOptional, IsBoolean } from 'class-validator';

export class UpdateWorkflowDto extends PartialType(CreateWorkflowDto) {
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
