import http from './client'

export interface CaptchaData {
  captchaId: string
  svg: string
}

export interface UserInfo {
  id: string
  username: string
  email: string
  role: string
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export interface LoginResponse {
  accessToken: string
  user: UserInfo
}

interface PublicKeyResponse {
  publicKey: string
}

let cachedPublicKey: string | null = null

export const clearPublicKeyCache = (): void => {
  cachedPublicKey = null
}

export const getToken = (): string | null => {
  return localStorage.getItem('token')
}

export const setToken = (token: string): void => {
  localStorage.setItem('token', token)
}

export const removeToken = (): void => {
  localStorage.removeItem('token')
}

export const isAuthenticated = (): boolean => {
  return !!getToken()
}

export const authApi = {
  getCaptcha: () => http.get<CaptchaData>('/auth/captcha'),

  getPublicKey: async (): Promise<string> => {
    if (cachedPublicKey) return cachedPublicKey
    const data = await http.get<PublicKeyResponse>('/auth/public-key')
    cachedPublicKey = data.publicKey
    return cachedPublicKey
  },

  encryptPassword: async (password: string): Promise<string> => {
    const publicKey = await authApi.getPublicKey()
    const { JSEncrypt } = await import('jsencrypt')
    const encrypt = new JSEncrypt()
    encrypt.setPublicKey(publicKey)
    const encrypted = encrypt.encrypt(password)
    if (!encrypted) {
      throw new Error('密码加密失败，请刷新页面后重试')
    }
    return encrypted
  },

  login: async (
    username: string,
    password: string,
    captchaId: string,
    captchaCode: string,
  ): Promise<LoginResponse> => {
    const encryptedPassword = await authApi.encryptPassword(password)
    const data = await http.post<LoginResponse>('/auth/login', {
      username,
      encryptedPassword,
      captchaId,
      captchaCode,
    })
    setToken(data.accessToken)
    return data
  },

  register: async (
    username: string,
    email: string,
    password: string,
    captchaId: string,
    captchaCode: string,
  ): Promise<void> => {
    const encryptedPassword = await authApi.encryptPassword(password)
    await http.post('/auth/register', {
      username,
      email,
      encryptedPassword,
      captchaId,
      captchaCode,
    })
  },

  getUserInfo: () => http.get<UserInfo>('/user/info'),

  logout: () => http.post<void>('/auth/logout'),
}
