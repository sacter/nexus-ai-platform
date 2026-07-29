import { Injectable } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import * as svgCaptcha from 'svg-captcha';

interface CaptchaEntry {
  text: string;
  expireAt: number;
}

@Injectable()
export class CaptchaService {
  private readonly captchaMap = new Map<string, CaptchaEntry>();
  private readonly CAPTCHA_TTL = 5 * 60 * 1000; // 5 分钟

  constructor() {
    // 每分钟清理过期验证码
    setInterval(() => this.cleanup(), 60_000);
  }

  generateCaptcha(): { captchaId: string; svg: string } {
    const svgCaptchaParams = {
      size: 4,
      ignoreChars: 'o0il1',
      noise: 2,
      color: true,
      background: '#1c2840',
      width: 150,
      height: 50,
      fontSize: 56,
    };
    const captcha = svgCaptcha.create(svgCaptchaParams);

    const captchaId = uuidv4();
    this.captchaMap.set(captchaId, {
      text: captcha.text.toLowerCase(),
      expireAt: Date.now() + this.CAPTCHA_TTL,
    });

    return { captchaId, svg: captcha.data };
  }

  verifyCaptcha(captchaId: string, code: string): boolean {
    const entry = this.captchaMap.get(captchaId);
    if (!entry) return false;

    // 一次性使用，校验后立即删除
    this.captchaMap.delete(captchaId);

    // 已过期
    if (Date.now() > entry.expireAt) return false;

    // 不区分大小写
    return entry.text === code.toLowerCase();
  }

  private cleanup() {
    const now = Date.now();
    for (const [key, entry] of this.captchaMap) {
      if (now > entry.expireAt) {
        this.captchaMap.delete(key);
      }
    }
  }
}
