import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';

/**
 * JWT 载荷结构（与 AuthService.login() 签发的 token 一致）
 */
export interface JwtPayload {
  /** 用户 ID (uuid) */
  sub: string;
  /** 用户名 */
  username: string;
  /** 角色：admin | user */
  role: string;
}

/**
 * 从 request.user 中提取当前登录用户信息
 *
 * AuthGuard 校验 JWT 通过后将 payload 挂载到 request.user，
 * 本装饰器从 request.user 中提取数据。
 *
 * @example
 * ```ts
 * @Get('profile')
 * getProfile(@CurrentUser() user: JwtPayload) {
 *   return user; // { sub, username, role }
 * }
 *
 * @Get('admin-only')
 * adminOnly(@CurrentUser('role') role: string) {
 *   // role === 'admin' | 'user'
 * }
 * ```
 */
export const CurrentUser = createParamDecorator(
  (data: keyof JwtPayload | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest<Request>();
    const user = request.user as JwtPayload | undefined;
    return data ? user?.[data] : user;
  },
);
