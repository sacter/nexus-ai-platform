import {
  IsUUID,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

/**
 * 切换活跃版本 DTO
 */
export class ActivateVersionDto {
  @IsUUID('4', { message: '版本 ID 格式不正确' })
  @IsNotEmpty({ message: '版本 ID 不能为空' })
  versionId!: string;
}

/**
 * 保存元数据请求 DTO（用于 /save-meta）
 */
export class SaveDocumentMetaDto {
  @IsString()
  @IsNotEmpty({ message: '文件名称不能为空' })
  @MaxLength(512)
  name!: string;

  @IsString()
  @IsNotEmpty({ message: '原始文件名不能为空' })
  @MaxLength(512)
  originalName!: string;

  @IsString()
  @IsNotEmpty({ message: 'URL 不能为空' })
  @MaxLength(1024)
  url!: string;

  @IsNotEmpty({ message: '文件大小不能为空' })
  fileSize!: number;

  @IsString()
  @IsNotEmpty({ message: 'MIME 类型不能为空' })
  @MaxLength(128)
  mimeType!: string;

  @IsOptional()
  pageCount?: number;

  @IsString()
  @IsOptional()
  @MaxLength(128)
  idempotencyKey?: string;
}
