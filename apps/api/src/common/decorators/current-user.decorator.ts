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
  /** JWT 唯一标识，用于登出时加入黑名单 */
  jti: string;
  /** JWT 过期时间戳（秒），由 @nestjs/jwt 自动注入 */
  exp?: number;
  /** JWT 签发时间戳（秒） */
  iat?: number;
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
    const user = request.user;
    return data ? user?.[data] : user;
  },
);
