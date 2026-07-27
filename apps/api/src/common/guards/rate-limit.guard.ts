import {
  Injectable,
  CanActivate,
  ExecutionContext,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';

/**
 * 限流配置
 */
export interface RateLimitOptions {
  /** 时间窗口（毫秒），默认 60 秒 */
  windowMs: number;
  /** 窗口内最大请求数，默认 10 */
  limit: number;
  /** 限流提示消息 */
  message?: string;
}

interface IpEntry {
  /** 窗口起始时间戳 */
  windowStart: number;
  /** 当前窗口内已请求次数 */
  count: number;
}

const CLEANUP_INTERVAL = 60_000; // 每分钟清理一次过期记录
// 超过此阈值自动清理过期条目，防止 Map 膨胀
const MAX_SCAN_ENTRIES = 10_000;

/**
 * 基于 IP 的请求频率限制守卫
 *
 * 使用内存 Map 按 IP 追踪请求频率，同一 IP 在时间窗口内超过限制返回 429。
 * 适用于防爬虫、防爆破场景（验证码获取、登录等）。
 *
 * @example
 * ```ts
 * @Get('captcha')
 * @UseGuards(new RateLimitGuard({ windowMs: 60_000, limit: 10 }))
 * getCaptcha() { ... }
 * ```
 */
@Injectable()
export class RateLimitGuard implements CanActivate {
  private readonly logger = new Logger(RateLimitGuard.name);
  private readonly ipMap = new Map<string, IpEntry>();
  private cleanupTimer: ReturnType<typeof setInterval> | null = null;

  constructor(private readonly options: RateLimitOptions) {
    // 启动定时清理，避免内存泄漏
    this.startCleanup();
  }

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const response = context.switchToHttp().getResponse<Response>();
    const ip = this.getClientIp(request);

    // 无法识别 IP 时放行（fail-open）：所有 unknown 请求共享同一个 key 会导致
    // 一人超限全部被挡，宁可放过也不误伤正常用户
    if (ip === 'unknown') {
      this.logger.warn('Cannot determine client IP, skipping rate limit');
      return true;
    }

    const now = Date.now();
    const entry = this.ipMap.get(ip);

    if (!entry || now - entry.windowStart > this.options.windowMs) {
      // 首次请求，或上一窗口已过期 → 重置窗口
      this.ipMap.set(ip, { windowStart: now, count: 1 });
      this.setRateLimitHeaders(response, this.options.limit - 1);
      return true;
    }

    // 窗口内请求
    entry.count++;

    const remaining = Math.max(0, this.options.limit - entry.count);

    if (entry.count > this.options.limit) {
      // 超过限制
      const resetSeconds = Math.ceil(
        (entry.windowStart + this.options.windowMs - now) / 1000,
      );

      this.logger.warn(
        `Rate limit exceeded for IP=${ip} — ${entry.count}/${this.options.limit} ` +
          `(reset in ${resetSeconds}s)`,
      );

      response.status(HttpStatus.TOO_MANY_REQUESTS);
      response.setHeader('Retry-After', String(resetSeconds));
      this.setRateLimitHeaders(response, 0);

      response.json({
        code: HttpStatus.TOO_MANY_REQUESTS,
        message:
          this.options.message ?? `请求过于频繁，请 ${resetSeconds} 秒后重试`,
        data: null,
        timestamp: new Date().toISOString(),
        path: request.url,
      });

      return false;
    }

    this.setRateLimitHeaders(response, remaining);
    return true;
  }

  /**
   * 设置标准 RateLimit 响应头
   */
  private setRateLimitHeaders(response: Response, remaining: number) {
    response.setHeader('X-RateLimit-Limit', String(this.options.limit));
    response.setHeader('X-RateLimit-Remaining', String(remaining));
  }

  /**
   * 从请求中提取客户端真实 IP
   * 优先取 X-Forwarded-For / X-Real-IP（反向代理场景），兜底取 socket 地址
   */
  private getClientIp(request: Request): string {
    const xForwardedFor = request.headers['x-forwarded-for'];
    if (typeof xForwardedFor === 'string') {
      // X-Forwarded-For: client, proxy1, proxy2 → 取第一个
      return xForwardedFor.split(',')[0].trim();
    }

    const xRealIp = request.headers['x-real-ip'];
    if (typeof xRealIp === 'string') {
      return xRealIp;
    }

    return request.socket?.remoteAddress ?? 'unknown';
  }

  /**
   * 定时清理过期 IP 记录，防止内存无限增长
   */
  private startCleanup() {
    this.cleanupTimer = setInterval(() => {
      const now = Date.now();
      // let cleaned = 0;

      for (const [ip, entry] of this.ipMap) {
        if (now - entry.windowStart > this.options.windowMs * 2) {
          this.ipMap.delete(ip);
          // cleaned++;
        }
      }

      // 若 Map 异常膨胀，进行一次全量扫描清理
      if (this.ipMap.size > MAX_SCAN_ENTRIES) {
        this.logger.warn(
          `IP rate-limit map size ${this.ipMap.size} exceeds threshold, full scan triggered`,
        );
        let fullCleaned = 0;
        for (const [ip, entry] of this.ipMap) {
          if (now - entry.windowStart > this.options.windowMs) {
            this.ipMap.delete(ip);
            fullCleaned++;
          }
        }
        this.logger.log(
          `Full cleanup: removed ${fullCleaned} stale IP entries`,
        );
      }
    }, CLEANUP_INTERVAL);
  }

  /** 清理定时器（仅测试或特殊场景使用） */
  destroy() {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
  }
}
