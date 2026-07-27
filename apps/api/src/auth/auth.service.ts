import {
  Injectable,
  ConflictException,
  UnauthorizedException,
} from '@nestjs/common';
import { UserService } from '../user/user.service';
import { CaptchaService } from './captcha.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import * as bcrypt from 'bcrypt';

@Injectable()
export class AuthService {
  constructor(
    private readonly userService: UserService,
    private readonly captchaService: CaptchaService,
  ) {}

  async register(dto: RegisterDto) {
    if (!this.captchaService.verifyCaptcha(dto.captchaId, dto.captchaCode)) {
      throw new UnauthorizedException('验证码错误或已过期');
    }

    const existingUser =
      (await this.userService.findByEmail(dto.email)) ??
      (await this.userService.findByUsername(dto.username));
    if (existingUser) {
      throw new ConflictException('用户名或邮箱已存在');
    }
    return this.userService.create(dto);
  }

  async login(dto: LoginDto) {
    if (!this.captchaService.verifyCaptcha(dto.captchaId, dto.captchaCode)) {
      throw new UnauthorizedException('验证码错误或已过期');
    }

    const user = await this.userService.findByUsername(dto.username);
    if (!user) {
      throw new UnauthorizedException('用户名或密码错误');
    }
    const valid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!valid) {
      throw new UnauthorizedException('用户名或密码错误');
    }
    // TODO: 后续接入 JWT 返回 token
    return {
      message: '登录成功',
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
      },
    };
  }
}
