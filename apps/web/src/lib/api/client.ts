import axios from 'axios';

const http = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000',
  timeout: 30000,
  headers: { 'Content-Type': 'application/json' },
});

// --- 请求拦截：自动附加 Authorization token ---
http.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
});

// --- 响应拦截：统一解包 data + 错误处理 ---
http.interceptors.response.use(
  (response) => response.data,
  (error) => {
    // 401 自动跳转登录
    if (error.response?.status === 401) {
      if (typeof window !== 'undefined') {
        localStorage.removeItem('token');
        window.location.href = '/login';
      }
    }
    const message =
      error.response?.data?.message || error.message || '请求失败';
    return Promise.reject(new Error(message));
  },
);

export default http;
