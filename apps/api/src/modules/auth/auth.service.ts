import {
  Injectable,
  ConflictException,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { JwtService } from '@nestjs/jwt';
import { UserService } from '../user/user.service';
import { CaptchaService } from './captcha.service';
import { PublicKeyService } from './public-key.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import type { JwtPayload } from '../../common/decorators/current-user.decorator';
import * as bcrypt from 'bcrypt';

@Injectable()
export class AuthService {
  constructor(
    private readonly userService: UserService,
    private readonly captchaService: CaptchaService,
    private readonly publicKeyService: PublicKeyService,
    private readonly jwtService: JwtService,
  ) {}

  async register(dto: RegisterDto) {
    // 1. 验证码校验
    if (!this.captchaService.verifyCaptcha(dto.captchaId, dto.captchaCode)) {
      throw new UnauthorizedException('验证码错误或已过期');
    }

    // 2. 检查用户名/邮箱是否已存在
    const existingUser =
      (await this.userService.findByEmail(dto.email)) ??
      (await this.userService.findByUsername(dto.username));
    if (existingUser) {
      throw new ConflictException('用户名或邮箱已存在');
    }

    // 3. RSA 解密密码
    let plaintextPassword: string;
    try {
      plaintextPassword = this.publicKeyService.decrypt(dto.encryptedPassword);
    } catch {
      throw new BadRequestException('密码解密失败，请刷新页面后重试');
    }

    // 4. 明文密码复杂度校验（后端兜底，前端 zod 已做主要校验）
    if (plaintextPassword.length < 6 || plaintextPassword.length > 15) {
      throw new BadRequestException('密码长度需在6-15位之间');
    }

    // 5. 创建用户（UserService 内部 bcrypt 加盐哈希）
    return this.userService.create({
      username: dto.username,
      email: dto.email,
      password: plaintextPassword,
      role: dto.role,
    });
  }

  async login(dto: LoginDto) {
    // 1. 验证码校验
    if (!this.captchaService.verifyCaptcha(dto.captchaId, dto.captchaCode)) {
      throw new UnauthorizedException('验证码错误或已过期');
    }

    // 2. 查找用户
    const user = await this.userService.findByUsername(dto.username);
    if (!user) {
      throw new UnauthorizedException('用户名或密码错误');
    }

    // 3. RSA 解密密码（解密失败返回通用错误，防止信息泄漏）
    let plaintextPassword: string;
    try {
      plaintextPassword = this.publicKeyService.decrypt(dto.encryptedPassword);
    } catch {
      throw new UnauthorizedException('用户名或密码错误');
    }

    // 4. bcrypt 比对
    const valid = await bcrypt.compare(plaintextPassword, user.passwordHash);
    if (!valid) {
      throw new UnauthorizedException('用户名或密码错误');
    }

    // 5. 签发 JWT（含 jti 用于登出时黑名单）
    const payload: JwtPayload = {
      sub: user.id,
      username: user.username,
      role: user.role,
      jti: randomUUID(),
    };
    const accessToken = this.jwtService.sign(payload);

    return {
      accessToken,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
      },
    };
  }
}
