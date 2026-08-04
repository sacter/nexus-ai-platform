import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { UploadService } from './upload.service';
import { GetStsDto } from './dto/get-sts.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { JwtPayload } from '../../common/decorators/current-user.decorator';
import { KbPermissionGuard } from '../../common/guards/kb-permission.guard';

/**
 * 上传控制器
 *
 * 提供前端直传 MinIO 所需的 STS 临时凭证
 *
 * 安全链路：
 * - 全局 AuthGuard：JWT 登录鉴权
 * - KbPermissionGuard：校验当前用户对 kbId 拥有 admin/editor 上传权限
 * - MinIO STS Policy：限定只能 PutObject 到 kb/{kbId}/ 前缀
 */
@Controller('upload')
export class UploadController {
  constructor(private readonly uploadService: UploadService) {}

  /**
   * GET /api/v1/upload/get-minio-sts?kbId=xxx
   *
   * 获取 MinIO STS 临时凭证（前端直传凭据）
   *
   * 权限：admin / editor
   * viewer 被 KbPermissionGuard 拒绝
   */
  @Get('get-minio-sts')
  @UseGuards(KbPermissionGuard)
  async getMinioSts(
    @Query() query: GetStsDto,
    @CurrentUser() user: JwtPayload,
  ) {
    const sts = await this.uploadService.getMinioSts(query.kbId, user.sub);
    return {
      ...sts,
      // 同时返回白名单供前端校验
      allowedTypes: this.uploadService.getAllowedTypes(),
    };
  }
}
