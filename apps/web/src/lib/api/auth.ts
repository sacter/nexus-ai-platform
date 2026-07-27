import http from './client';

export interface CaptchaData {
  captchaId: string;
  svg: string;
}

export const authApi = {
  /** 获取验证码 */
  getCaptcha: () => http.get<CaptchaData>('/auth/captcha'),
};
