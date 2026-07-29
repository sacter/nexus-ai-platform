import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';

/**
 * Token 黑名单服务
 *
 * 登出时将 JWT 的 jti 加入黑名单，AuthGuard 在验证时检查。
 * 使用内存 Map 存储，服务重启后清空（可接受，token 本身有时效性）。
 *
 * 自动清理：每 10 分钟清除已过期的黑名单条目，防止内存泄漏。
 */
@Injectable()
export class TokenBlacklistService implements OnModuleDestroy {
  private readonly logger = new Logger(TokenBlacklistService.name);

  /** Map<jti, 过期时间戳(ms)> */
  private readonly blacklist = new Map<string, number>();

  /** 每 10 分钟清理一次过期条目 */
  private readonly cleanupTimer: ReturnType<typeof setInterval>;

  /** 清理间隔：10 分钟 */
  private static readonly CLEANUP_INTERVAL_MS = 10 * 60 * 1000;

  constructor() {
    this.cleanupTimer = setInterval(() => {
      this.cleanup();
    }, TokenBlacklistService.CLEANUP_INTERVAL_MS);

    // Node.js 允许定时器不阻塞进程退出
    this.cleanupTimer.unref();
  }

  /**
   * 将 token 加入黑名单
   * @param jti - JWT 唯一标识
   * @param exp - token 过期时间戳（秒）
   */
  add(jti: string, exp: number): void {
    // 过期时间戳转毫秒
    this.blacklist.set(jti, exp * 1000);
    this.logger.log(`Token blacklisted: jti=${jti.slice(0, 8)}...`);
  }

  /**
   * 检查 token 是否在黑名单中
   * @returns true 表示已被拉黑（无效 token）
   */
  isBlacklisted(jti: string): boolean {
    const expMs = this.blacklist.get(jti);
    if (expMs === undefined) return false;

    // 如果已过期，视为不在黑名单（清理线程会定期扫除）
    if (Date.now() > expMs) {
      this.blacklist.delete(jti);
      return false;
    }

    return true;
  }

  /**
   * 清理已过期的黑名单条目
   */
  private cleanup(): void {
    const now = Date.now();
    let removed = 0;
    for (const [jti, expMs] of this.blacklist) {
      if (now > expMs) {
        this.blacklist.delete(jti);
        removed++;
      }
    }
    if (removed > 0) {
      this.logger.log(`Cleaned ${removed} expired blacklist entries`);
    }
  }

  onModuleDestroy(): void {
    clearInterval(this.cleanupTimer);
  }
}
