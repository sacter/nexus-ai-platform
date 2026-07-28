/**
 * Express Request 类型增强
 *
 * AuthGuard 在校验 JWT 后将 payload 挂载到 request.user，
 * @CurrentUser() 装饰器从 request.user 中提取数据。
 */
declare namespace Express {
  interface Request {
    user?: import('../common/decorators/current-user.decorator').JwtPayload;
  }
}
