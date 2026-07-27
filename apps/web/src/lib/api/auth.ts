import http from './client';

// ── Types ──

export interface CaptchaData {
  captchaId: string;
  svg: string;
}

export interface LoginResponse {
  accessToken: string;
  user: {
    id: string;
    username: string;
    email: string;
    role: string;
  };
}

interface PublicKeyResponse {
  publicKey: string;
}

// ── Public key 缓存（模块级，SPA 内跨页面复用，刷新后重新获取） ──
let cachedPublicKey: string | null = null;

/** 清除缓存的公钥（解密失败时调用，强制重新获取） */
export const clearPublicKeyCache = (): void => {
  cachedPublicKey = null;
};

// ── Token 管理（与 axios 拦截器共用 localStorage key 'token'） ──

export const getToken = (): string | null => {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('token');
};

export const setToken = (token: string): void => {
  localStorage.setItem('token', token);
};

export const removeToken = (): void => {
  localStorage.removeItem('token');
};

export const isAuthenticated = (): boolean => {
  return !!getToken();
};

// ── Auth API ──

export const authApi = {
  /** 获取验证码 SVG */
  getCaptcha: () => http.get<CaptchaData>('/auth/captcha'),

  /** 获取 RSA-2048 公钥（首次请求后缓存于内存） */
  getPublicKey: async (): Promise<string> => {
    if (cachedPublicKey) return cachedPublicKey;
    const data = await http.get<PublicKeyResponse>('/auth/public-key');
    cachedPublicKey = data.publicKey;
    return cachedPublicKey;
  },

  /**
   * 用服务端 RSA 公钥加密明文密码
   *
   * 使用动态 import('jsencrypt') 避免 SSR 报错
   *（jsencrypt 内部依赖 window.crypto）
   */
  encryptPassword: async (password: string): Promise<string> => {
    const publicKey = await authApi.getPublicKey();
    const { JSEncrypt } = await import('jsencrypt');
    const encrypt = new JSEncrypt();
    encrypt.setPublicKey(publicKey);
    const encrypted = encrypt.encrypt(password);
    if (!encrypted) {
      throw new Error('密码加密失败，请刷新页面后重试');
    }
    return encrypted;
  },

  /**
   * 登录：RSA 加密密码 → 发送凭证 → 存储 token
   *
   * @returns 登录响应（含 accessToken 和用户信息）
   */
  login: async (
    username: string,
    password: string,
    captchaId: string,
    captchaCode: string,
  ): Promise<LoginResponse> => {
    const encryptedPassword = await authApi.encryptPassword(password);
    const data = await http.post<LoginResponse>('/auth/login', {
      username,
      encryptedPassword,
      captchaId,
      captchaCode,
    });
    setToken(data.accessToken);
    return data;
  },

  /**
   * 注册：RSA 加密密码 → 发送注册数据
   */
  register: async (
    username: string,
    email: string,
    password: string,
    captchaId: string,
    captchaCode: string,
  ): Promise<void> => {
    const encryptedPassword = await authApi.encryptPassword(password);
    await http.post('/auth/register', {
      username,
      email,
      encryptedPassword,
      captchaId,
      captchaCode,
    });
  },
};
