import axios from 'axios'

interface ApiResponse<T = unknown> {
  code: number
  message: string
  data: T | null
  timestamp: string
  path: string
}

const instance = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? 'http://localhost:3000',
  timeout: 30000,
  headers: { 'Content-Type': 'application/json' },
})

instance.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

instance.interceptors.response.use(
  ((response: { data: unknown }) => {
    const body = response.data as ApiResponse
    if (body !== null && typeof body === 'object' && 'code' in body) {
      if (body.code === 0) {
        return body.data
      }
      return Promise.reject(new Error(body.message || '请求失败'))
    }
    return body
  }) as never,
  (error) => {
    if (error.response?.status === 401) {
      const path = window.location.pathname
      if (path !== '/login' && path !== '/register') {
        localStorage.removeItem('token')
        window.location.href = '/login'
      }
    }

    const serverMessage = error.response?.data?.message
    const message = serverMessage || error.message || '网络异常，请稍后重试'

    return Promise.reject(new Error(message))
  },
)

const http = instance as unknown as {
  get<T = unknown>(url: string, config?: Record<string, unknown>): Promise<T>
  post<T = unknown>(url: string, data?: unknown, config?: Record<string, unknown>): Promise<T>
  patch<T = unknown>(url: string, data?: unknown, config?: Record<string, unknown>): Promise<T>
  delete<T = unknown>(url: string, config?: Record<string, unknown>): Promise<T>
}

export default http
