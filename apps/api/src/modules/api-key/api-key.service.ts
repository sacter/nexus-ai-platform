import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '@nexus/database';
import { PublicKeyService } from '../auth/public-key.service';
import { CreateApiKeyDto } from './dto/create-api-key.dto';
import { UpdateApiKeyDto } from './dto/update-api-key.dto';

@Injectable()
export class ApiKeyService {
  private readonly logger = new Logger(ApiKeyService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly publicKeyService: PublicKeyService,
  ) {}

  create(dto: CreateApiKeyDto, userId: string) {
    // 3. RSA 解密密码
    let plaintextApiKey: string;
    try {
      plaintextApiKey = this.publicKeyService.decrypt(dto.apiKey);
    } catch {
      throw new BadRequestException('apiKey解密失败，请重试');
    }
    this.logger.log(`Decrypted apiKey: ${plaintextApiKey}`);
    // AES 主密钥为 hex 编码的 32 字节（.env: AES_ENCRYPTION_KEY）
    const aesKeyHex = process.env.AES_ENCRYPTION_KEY;
    if (!aesKeyHex) throw new Error('AES_ENCRYPTION_KEY 未配置');
    const { cipherText, nonce, tag } = this.publicKeyService.aesGcmEncrypt(
      plaintextApiKey,
      Buffer.from(aesKeyHex, 'hex'),
    );
    return this.prisma.apiKey.create({
      data: { ...dto, apiKey: cipherText, nonce, tag, createdBy: userId },
    });
  }

  findAll() {
    return this.prisma.apiKey.findMany();
  }

  findOne(id: string) {
    return this.prisma.apiKey.findUnique({ where: { id } });
  }

  update(id: string, updateApiKeyDto: UpdateApiKeyDto) {
    return this.prisma.apiKey.update({ where: { id }, data: updateApiKeyDto });
  }

  remove(id: string) {
    return this.prisma.apiKey.delete({ where: { id } });
  }
}
