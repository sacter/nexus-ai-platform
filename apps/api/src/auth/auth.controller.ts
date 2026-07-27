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
import { PublicKeyService } from './public-key.service';
import { RateLimitGuard } from '../common/guards/rate-limit.guard';
import { Public } from '../common/decorators/public.decorator';

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

/**
 * Auth Controller — 所有路由均为公开接口
 *
 * @Public() 类级别装饰器使全局 AuthGuard 放行整个 Controller
 */
@Controller('auth')
@Public()
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly captchaService: CaptchaService,
    private readonly publicKeyService: PublicKeyService,
  ) {}

  /** 获取 RSA-2048 公钥（前端加密密码用） */
  @Get('public-key')
  getPublicKey() {
    return { publicKey: this.publicKeyService.publicKey };
  }

  /** 获取图形验证码 SVG */
  @Get('captcha')
  @UseGuards(new RateLimitGuard(CAPTCHA_RATE_LIMIT))
  getCaptcha() {
    return this.captchaService.generateCaptcha();
  }

  /** 用户名+密码登录，返回 JWT accessToken */
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @UseGuards(new RateLimitGuard(LOGIN_RATE_LIMIT))
  login(@Body() loginDto: LoginDto) {
    return this.authService.login(loginDto);
  }

  /** 注册新用户 */
  @Post('register')
  @UseGuards(new RateLimitGuard(REGISTER_RATE_LIMIT))
  register(@Body() registerDto: RegisterDto) {
    return this.authService.register(registerDto);
  }
}
