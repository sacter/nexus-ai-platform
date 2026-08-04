import { Injectable, Logger } from '@nestjs/common';
import { MinioService } from '../../infrastructure/minio/minio.service';
import type { StsCredentials } from '../../infrastructure/minio/minio.service';

/**
 * 上传服务
 *
 * 职责：
 * - 校验 KB 权限后签发 MinIO STS 临时凭证
 * - 前端用 STS 凭证直传 MinIO 后，回写元数据到数据库
 */
@Injectable()
export class UploadService {
  private readonly logger = new Logger(UploadService.name);

  constructor(private readonly minioService: MinioService) {}

  /**
   * 获取 MinIO STS 临时凭证
   *
   * 步骤：
   * 1. JWT 鉴权（由全局 AuthGuard 完成）
   * 2. KB 权限校验（由 KbPermissionGuard 完成，要求 admin/editor）
   * 3. 生成 STS 临时凭证（Policy 限定 kb/{kbId}/ 前缀，仅 PutObject）
   */
  async getMinioSts(kbId: string, userId: string): Promise<StsCredentials> {
    this.logger.log(`Generating STS for kbId=${kbId}, userId=${userId}`);
    return this.minioService.generateStsCredentials(kbId, userId);
  }

  /**
   * 获取允许上传的文件类型白名单
   */
  getAllowedTypes(): { mimeTypes: string[]; extensions: string[] } {
    const {
      ALLOWED_MIME_TYPES,
      ALLOWED_EXTENSIONS,
    } = require('../../../infrastructure/minio/minio.service');

    return {
      mimeTypes: ALLOWED_MIME_TYPES,
      extensions: ALLOWED_EXTENSIONS,
    };
  }
}
