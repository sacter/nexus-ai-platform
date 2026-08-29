import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import type { Request } from 'express';
import type { ApiResponse } from '../interfaces/response.interface';

/**
 * 统一响应拦截器
 *
 * 将所有成功响应包装为：
 *   { code: 0, message: 'success', data: <原始响应>, timestamp, path }
 *
 * 异常响应由 HttpExceptionFilter 统一处理。
 *
 * ★ SSE 路由：handler 上用 @SetMetadata(SKIP_RESPONSE_WRAP, true) 标记，直接透传
 * （流式响应不能被包装成 {code, data}，且手动 @Res() 写流后 Nest 不再发送）。
 */
export const SKIP_RESPONSE_WRAP = 'skip-response-wrap';

@Injectable()
export class ResponseInterceptor<T> implements NestInterceptor<
  T,
  ApiResponse<T>
> {
  intercept(
    context: ExecutionContext,
    next: CallHandler<T>,
  ): Observable<ApiResponse<T>> {
    if (Reflect.getMetadata(SKIP_RESPONSE_WRAP, context.getHandler())) {
      // 直通流式响应（SSE 手动 @Res 写流），不包装成 {code, data}
      return next.handle() as Observable<ApiResponse<T>>;
    }

    const ctx = context.switchToHttp();
    const request = ctx.getRequest<Request>();

    return next.handle().pipe(
      map((data) => ({
        code: 0 as const,
        message: 'success',
        data: data ?? null,
        timestamp: new Date().toISOString(),
        path: request.url,
      })),
    );
  }
}
