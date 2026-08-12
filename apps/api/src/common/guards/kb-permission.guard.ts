import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '@nexus/database';
import type { Request } from 'express';

/**
 * KB 权限守卫 — 校验当前用户对指定知识库是否拥有上传/编辑权限
 *
 * 用法：
 * ```ts
 * @UseGuards(KbPermissionGuard)
 * @Post('upload')
 * upload(@Param('kbId') kbId: string) { ... }
 * ```
 *
 * 从 req.params.kbId 提取 kbId，从 req.user 提取当前用户信息，
 * 查询 kb_permissions 表校验用户角色。
 *
 * 允许的角色：admin, editor
 * viewer 直接拒绝（403）
 */
@Injectable()
export class KbPermissionGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const user = request.user;
    // 从路由参数或查询参数中提取 kbId
    const kbId: string | undefined =
      (request.params as Record<string, string>)?.['kbId'] ??
      (typeof request.query?.kbId === 'string'
        ? request.query.kbId
        : undefined);

    if (!user?.sub) {
      throw new ForbiddenException('未登录，无权操作');
    }

    if (!kbId) {
      throw new ForbiddenException('缺少知识库 ID');
    }

    const permission = await this.prisma.kbPermission.findUnique({
      where: {
        kbId_userId: { kbId, userId: user.sub },
      },
    });

    if (!permission) {
      throw new ForbiddenException('您不是该知识库的成员，无权操作');
    }

    if (permission.role === 'viewer') {
      throw new ForbiddenException('您只有查看权限，无法进行此操作');
    }

    // admin / editor 允许通过
    return true;
  }
}
