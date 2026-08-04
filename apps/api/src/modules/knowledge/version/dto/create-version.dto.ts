import {
  IsUUID,
  IsNotEmpty,
  IsString,
  IsInt,
  IsOptional,
  Min,
  IsIn,
} from 'class-validator';
import type { VersionStatus } from '@prisma/client';

const VALID_STATUSES: VersionStatus[] = ['PROCESSING', 'READY', 'FAILED'];

export class CreateVersionDto {
  @IsUUID('4')
  @IsNotEmpty()
  documentId!: string;

  @IsInt()
  @Min(1)
  versionNumber!: number;

  @IsString()
  @IsNotEmpty()
  fileUrl!: string;

  @IsInt()
  @IsOptional()
  @Min(0)
  pageCount?: number;

  @IsInt()
  @IsOptional()
  @Min(0)
  chunkCount?: number;

  @IsString()
  @IsOptional()
  @IsIn(VALID_STATUSES, {
    message: '状态值无效，有效值：PROCESSING, READY, FAILED',
  })
  status?: VersionStatus;

  @IsString()
  @IsOptional()
  changeSummary?: string;

  @IsUUID('4')
  @IsOptional()
  createdBy?: string;
}
