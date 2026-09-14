import {
  IsNotEmpty,
  IsString,
  IsObject,
  IsOptional,
  IsNumber,
  ValidateNested,
  IsIn,
  MaxLength,
} from 'class-validator';
import { Type } from 'class-transformer';
import {
  WORKFLOW_NODE_TYPES,
  WORKFLOW_TYPES,
} from '../interface/workflow.interface';

export class WorkflowNodeInputDto {
  @IsString()
  @IsNotEmpty()
  clientId!: string;

  @IsIn(WORKFLOW_NODE_TYPES)
  type!: (typeof WORKFLOW_NODE_TYPES)[number];

  @IsString()
  label!: string;

  @IsOptional()
  @IsNumber()
  positionX?: number;

  @IsOptional()
  @IsNumber()
  positionY?: number;

  @IsOptional()
  @IsObject()
  config?: Record<string, any>;
}

export class WorkflowEdgeInputDto {
  @IsString()
  @IsNotEmpty()
  sourceClientId!: string;

  @IsString()
  @IsNotEmpty()
  targetClientId!: string;

  @IsOptional()
  @IsString()
  sourceHandle?: string;

  @IsOptional()
  @IsString()
  targetHandle?: string;

  @IsOptional()
  @IsString()
  label?: string;

  @IsOptional()
  @IsObject()
  condition?: Record<string, any>;
}

export class CreateWorkflowDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(256)
  name!: string;

  @IsIn(WORKFLOW_TYPES)
  type!: (typeof WORKFLOW_TYPES)[number];

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsObject()
  config?: Record<string, any>;

  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => WorkflowNodeInputDto)
  nodes?: WorkflowNodeInputDto[];

  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => WorkflowEdgeInputDto)
  edges?: WorkflowEdgeInputDto[];
}
