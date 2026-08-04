import {
  IsUUID,
  IsNotEmpty,
  IsString,
  IsInt,
  IsOptional,
  MaxLength,
  Min,
} from 'class-validator';

/**
 * 上传完成后回写元数据请求参数
 */
export class SaveMetaDto {
  @IsUUID('4', { message: '知识库 ID 格式不正确' })
  @IsNotEmpty({ message: '知识库 ID 不能为空' })
  kbId!: string;

  @IsString()
  @IsNotEmpty({ message: '文件名称不能为空' })
  @MaxLength(512, { message: '文件名称最长 512 字符' })
  name!: string;

  @IsString()
  @IsNotEmpty({ message: '原始文件名不能为空' })
  @MaxLength(512, { message: '原始文件名最长 512 字符' })
  originalName!: string;

  @IsString()
  @IsNotEmpty({ message: '文件 URL（MinIO Object Key）不能为空' })
  @MaxLength(1024, { message: 'URL 最长 1024 字符' })
  url!: string;

  @IsInt()
  @Min(0, { message: '文件大小不能为负数' })
  fileSize!: number;

  @IsString()
  @IsNotEmpty({ message: 'MIME 类型不能为空' })
  @MaxLength(128, { message: 'MIME 类型最长 128 字符' })
  mimeType!: string;

  @IsInt()
  @IsOptional()
  @Min(0, { message: '页数不能为负数' })
  pageCount?: number;

  /**
   * 幂等键，防止重复提交创建重复版本
   */
  @IsString()
  @IsOptional()
  @MaxLength(128, { message: '幂等键最长 128 字符' })
  idempotencyKey?: string;
}
