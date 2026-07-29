import {
  IsEmail,
  IsString,
  MinLength,
  MaxLength,
  IsOptional,
} from 'class-validator';

export class RegisterDto {
  @IsString()
  @MinLength(2)
  @MaxLength(64)
  username!: string;

  @IsEmail()
  @MaxLength(255)
  email!: string;

  /** RSA-2048 加密后的 Base64 密码（~344 字节） */
  @IsString()
  encryptedPassword!: string;

  @IsOptional()
  @IsString()
  role?: 'admin' | 'user';

  @IsString()
  captchaId!: string;

  @IsString()
  captchaCode!: string;
}
