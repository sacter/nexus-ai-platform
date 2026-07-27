import {
  Controller,
  Get,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { CaptchaService } from './captcha.service';
import { RateLimitGuard } from '../common/guards/rate-limit.guard';

/**
 * 验证码接口限流配置
 * - windowMs: 60 秒时间窗口
 * - limit: 同一 IP 每 60 秒最多获取 10 次验证码
 * 防止同一 IP 恶意刷接口，打爆服务器资源
 */
const CAPTCHA_RATE_LIMIT = {
  windowMs: 60_000, // 1 分钟
  limit: 10, // 最多 10 次
  message: '验证码请求过于频繁，请 60 秒后重试',
};

/**
 * 登录接口限流配置
 * - windowMs: 60 秒时间窗口
 * - limit: 同一 IP 每 60 秒最多尝试 5 次登录
 * 防止暴力破解密码
 */
const LOGIN_RATE_LIMIT = {
  windowMs: 60_000, // 1 分钟
  limit: 5, // 最多 5 次
  message: '登录尝试过于频繁，请 60 秒后重试',
};

/**
 * 注册接口限流配置
 * - windowMs: 60 秒时间窗口
 * - limit: 同一 IP 每 60 秒最多注册 3 次
 * 防止脚本批量注册账号
 */
const REGISTER_RATE_LIMIT = {
  windowMs: 60_000, // 1 分钟
  limit: 3, // 最多 3 次
  message: '注册请求过于频繁，请 60 秒后重试',
};

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly captchaService: CaptchaService,
  ) {}

  @Get('captcha')
  @UseGuards(new RateLimitGuard(CAPTCHA_RATE_LIMIT))
  getCaptcha() {
    return this.captchaService.generateCaptcha();
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @UseGuards(new RateLimitGuard(LOGIN_RATE_LIMIT))
  login(@Body() loginDto: LoginDto) {
    return this.authService.login(loginDto);
  }

  @Post('register')
  @UseGuards(new RateLimitGuard(REGISTER_RATE_LIMIT))
  register(@Body() registerDto: RegisterDto) {
    return this.authService.register(registerDto);
  }
}
