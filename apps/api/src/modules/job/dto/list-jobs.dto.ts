import { IsIn, IsInt, IsOptional, IsString, IsUUID, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';
import type { JobStatus, JobType } from '@prisma/client';

export class ListJobsDto {
  @IsOptional()
  @IsUUID('4', { message: '文档 ID 格式不正确' })
  documentId?: string;

  @IsOptional()
  @IsUUID('4', { message: '知识库 ID 格式不正确' })
  kbId?: string;

  @IsOptional()
  @IsIn(['PENDING', 'RUNNING', 'DONE', 'FAILED'], { message: '任务状态不正确' })
  status?: JobStatus;

  @IsOptional()
  @IsIn(['INDEX', 'REINDEX', 'DELETE_CHUNKS'], { message: '任务类型不正确' })
  type?: JobType;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize?: number;

  @IsOptional()
  @IsString()
  keyword?: string;
}
