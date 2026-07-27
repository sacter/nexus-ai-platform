import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';

/**
 * 标记接口为公开访问，跳过 JWT 鉴权
 *
 * 用法：
 * - 方法级别：`@Public()` 单个路由公开
 * - 类级别：`@Public()` 整个 Controller 公开
 *
 * 全局 AuthGuard 默认拦截所有请求，仅 @Public() 标记的路由放行
 */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
