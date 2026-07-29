import { IsString, MinLength, MaxLength } from 'class-validator';

export class LoginDto {
  @IsString()
  @MinLength(2)
  @MaxLength(64)
  username!: string;

  /** RSA-2048 加密后的 Base64 密码（~344 字节） */
  @IsString()
  encryptedPassword!: string;

  @IsString()
  captchaId!: string;

  @IsString()
  captchaCode!: string;
}
