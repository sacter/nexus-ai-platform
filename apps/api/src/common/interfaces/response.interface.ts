/**
 * 统一 API 响应格式
 *
 * code = 0       → 业务成功
 * code = HTTP 状态码 → 业务失败（异常时由 ExceptionFilter 设置）
 */
export interface ApiResponse<T = unknown> {
  /** 业务状态码：0 成功，其它为错误码（HTTP 状态码） */
  code: number;
  /** 响应消息 */
  message: string;
  /** 响应数据 */
  data: T | null;
  /** 响应时间戳 (ISO 8601) */
  timestamp: string;
  /** 请求路径 */
  path: string;
}
