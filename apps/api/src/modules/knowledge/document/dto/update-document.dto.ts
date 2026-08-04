import { IsString, IsOptional, MaxLength, IsIn } from 'class-validator';
import type { DocumentStatus } from '@prisma/client';

const VALID_STATUSES: DocumentStatus[] = [
  'UPLOADING',
  'PROCESSING',
  'READY',
  'FAILED',
  'DELETED',
];

export class UpdateDocumentDto {
  @IsString()
  @IsOptional()
  @MaxLength(512, { message: '文件名称最长 512 字符' })
  name?: string;

  @IsString()
  @IsOptional()
  @IsIn(VALID_STATUSES, {
    message:
      '状态值无效，有效值：UPLOADING, PROCESSING, READY, FAILED, DELETED',
  })
  status?: DocumentStatus;

  @IsString()
  @IsOptional()
  errorMessage?: string;
}
