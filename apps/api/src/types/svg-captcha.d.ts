declare module 'svg-captcha' {
  interface Options {
    size?: number;
    ignoreChars?: string;
    noise?: number;
    color?: boolean;
    background?: string;
    width?: number;
    height?: number;
    fontSize?: number;
  }

  interface CaptchaResult {
    text: string;
    data: string;
  }

  export function create(options?: Options): CaptchaResult;
  export function createMathExpr(options?: Options): CaptchaResult;
}
