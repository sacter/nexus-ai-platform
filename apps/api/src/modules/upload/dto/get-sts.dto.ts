import { IsUUID, IsNotEmpty } from 'class-validator';

/**
 * 获取 MinIO STS 临时凭证请求参数
 */
export class GetStsDto {
  @IsUUID('4', { message: '知识库 ID 格式不正确' })
  @IsNotEmpty({ message: '知识库 ID 不能为空' })
  kbId!: string;
}
