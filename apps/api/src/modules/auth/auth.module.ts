import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';
import { CaptchaService } from './captcha.service';
import { PublicKeyService } from './public-key.service';
import { TokenBlacklistService } from './token-blacklist.service';
import { AuthGuard } from '../../common/guards/auth.guard';
import { AuthController } from './auth.controller';
import { UserModule } from '../user/user.module';

@Module({
  imports: [
    UserModule,
    // 注意：必须用 registerAsync 从 ConfigService 读取 JWT_SECRET。
    // 若用 register({ secret: process.env.JWT_SECRET })，模块加载时 .env 尚未加载，
    // 会静默回退到硬编码 fallback secret，导致线上配置失效。
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret:
          config.get<string>('JWT_SECRET') ||
          'nexus-dev-secret-change-in-production',
        signOptions: { expiresIn: '8h' },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    CaptchaService,
    PublicKeyService,
    TokenBlacklistService,
    {
      provide: APP_GUARD,
      useClass: AuthGuard,
    },
  ],
})
export class AuthModule {}
