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

const instance = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000',
  timeout: 30000,
  headers: { 'Content-Type': 'application/json' },
});

// ── 请求拦截器：自动附加 Authorization token ──
instance.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
});

// ── 响应拦截器：解包统一响应 + 统一错误处理 ──
// 拦截器在运行时解包 body.data，因此调用方 http.get<T>() 实际拿到 T。
// TypeScript 原生类型不支持这种变换，故用类型断言适配。
// 拦截器解包返回 data 而非 AxiosResponse，用类型断言适配
// eslint-disable-next-line @typescript-eslint/no-explicit-any
instance.interceptors.response.use(
  ((response: { data: unknown }) => {
    const body = response.data as ApiResponse;
    if (body !== null && typeof body === 'object' && 'code' in body) {
      if (body.code === 0) {
        return body.data;
      }
      return Promise.reject(new Error(body.message || '请求失败'));
    }
    return body;
  }) as any,
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

/**
 * 类型安全的 HTTP 客户端
 *
 * 拦截器在运行时已将 ApiResponse 解包为业务 data，
 * 此处断言对齐运行时行为，使调用方无需额外处理类型。
 */
const http = instance as unknown as {
  get<T = unknown>(url: string, config?: Record<string, unknown>): Promise<T>;
  post<T = unknown>(url: string, data?: unknown, config?: Record<string, unknown>): Promise<T>;
  patch<T = unknown>(url: string, data?: unknown, config?: Record<string, unknown>): Promise<T>;
  delete<T = unknown>(url: string, config?: Record<string, unknown>): Promise<T>;
};

export default http;
