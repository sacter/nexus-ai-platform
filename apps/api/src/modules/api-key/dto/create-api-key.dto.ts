import {
  IsNotEmpty,
  IsString,
  MinLength,
  MaxLength,
  IsOptional,
} from 'class-validator';

export class CreateApiKeyDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  provider!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(256)
  name!: string;

  @IsString()
  @IsOptional()
  @MaxLength(128)
  model?: string;

  @IsString()
  @IsOptional()
  @MaxLength(512)
  baseUrl?: string;

  // apiKey 为前端 RSA 加密后的密文，服务端解密后再用 AES-256-GCM 二次加密入库
  @IsString()
  @MinLength(1)
  @MaxLength(2048)
  apiKey!: string;
}
