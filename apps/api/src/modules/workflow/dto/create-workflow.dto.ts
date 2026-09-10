import {
  IsNotEmpty,
  IsString,
  IsObject,
  IsOptional,
  IsNumber,
  IsUUID,
  ValidateNested,
  IsIn,
} from 'class-validator';
import { Type } from 'class-transformer';

export class WorkflowNodeInputDto {
  @IsUUID()
  id!: string;

  @IsIn([
    'start',
    'end',
    'retriever',
    'llm',
    'tool',
    'condition',
    'reflection',
    'planner',
    'solver',
    'aggregator',
    'code',
  ])
  type!: string;

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
  @IsUUID()
  sourceNodeId!: string;

  @IsUUID()
  targetNodeId!: string;

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
  name!: string;

  @IsIn(['rag', 'reflection', 'rewoo', 'multi_agent', 'custom'])
  type!: string;

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
