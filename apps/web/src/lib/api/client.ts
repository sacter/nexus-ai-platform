import axios from 'axios';

// ── 后端统一响应格式 ──
// 与 apps/api 的 ResponseInterceptor / HttpExceptionFilter 保持一致
interface ApiResponse<T = unknown> {
  code: number;
  message: string;
  data: T | null;
  timestamp: string;
  path: string;
}

const http = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000',
  timeout: 30000,
  headers: { 'Content-Type': 'application/json' },
});

// ── 请求拦截器：自动附加 Authorization token ──
http.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
});

// ── 响应拦截器：解包统一响应 + 统一错误处理 ──
http.interceptors.response.use(
  // ── 2xx 成功响应 ──
  (response) => {
    const body = response.data as ApiResponse;

    // 后端 ResponseInterceptor 包装 → code 固定为 0
    if (body !== null && typeof body === 'object' && 'code' in body) {
      if (body.code === 0) {
        // 成功：返回解包后的业务 data
        return body.data;
      }
      // 业务错误（code !== 0）：转为异常走 reject
      return Promise.reject(new Error(body.message || '请求失败'));
    }

    // 非标准响应（不包含 code 字段）：原样返回
    return body;
  },

  // ── 4xx / 5xx 异常响应 ──
  (error) => {
    // 401 → 清除 token 并跳转登录（登录/注册页除外，避免错误密码也跳转的死循环）
    if (error.response?.status === 401) {
      if (typeof window !== 'undefined') {
        const path = window.location.pathname;
        if (path !== '/login' && path !== '/register') {
          localStorage.removeItem('token');
          window.location.href = '/login';
        }
      }
    }

    // 优先取后端 HttpExceptionFilter 返回的 message
    const serverMessage = error.response?.data?.message;
    const message =
      serverMessage || error.message || '网络异常，请稍后重试';

    return Promise.reject(new Error(message));
  },
);

export default http;
