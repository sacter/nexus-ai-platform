import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import type { Request } from 'express';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { TokenBlacklistService } from '../../modules/auth/token-blacklist.service';
import type { JwtPayload } from '../decorators/current-user.decorator';

/**
 * 全局 JWT 鉴权守卫
 *
 * 默认拦截所有请求，验证 Authorization: Bearer <token>。
 * 通过 @Public() 装饰器标记的路由/Controller 跳过鉴权。
 * 登出后 token 加入黑名单，守卫会拒绝黑名单中的 token。
 *
 * 注册方式：AuthModule 中通过 APP_GUARD token 全局注册
 */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly reflector: Reflector,
    private readonly blacklist: TokenBlacklistService,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    // 检查方法级别或类级别的 @Public() 装饰器
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest<Request>();
    const token = this.extractTokenFromHeader(request);

    if (!token) {
      throw new UnauthorizedException('未登录，请先登录');
    }

    try {
      const payload = this.jwtService.verify<JwtPayload>(token);

      // 检查 token 是否已被登出接口拉黑
      if (payload.jti && this.blacklist.isBlacklisted(payload.jti)) {
        throw new UnauthorizedException('登录已过期，请重新登录');
      }

      // 将 JWT payload 挂到 request 上，供 @CurrentUser() 装饰器提取
      request.user = payload;
    } catch (err) {
      if (err instanceof UnauthorizedException) throw err;
      throw new UnauthorizedException('登录已过期，请重新登录');
    }

    return true;
  }

  /**
   * 从请求头 Authorization: Bearer <token> 中提取 token
   */
  private extractTokenFromHeader(request: Request): string | undefined {
    const [type, token] = request.headers.authorization?.split(' ') ?? [];
    return type === 'Bearer' ? token : undefined;
  }
}
