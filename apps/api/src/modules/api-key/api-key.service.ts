import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '@nexus/database';
import { PublicKeyService } from '../auth/public-key.service';
import { CreateApiKeyDto } from './dto/create-api-key.dto';
import { UpdateApiKeyDto } from './dto/update-api-key.dto';

/** api_keys 表一行（Prisma 返回的标量字段） */
interface ApiKeyRow {
  id: string;
  provider: string;
  name: string;
  model: string;
  baseUrl: string | null;
  apiKey: string;
  nonce: string;
  tag: string;
  isActive: boolean;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

/** 对外返回结构：剔除 nonce/tag，apiKey 为明文（仅创建时）或脱敏值 */
type ApiKeyPublic = Omit<ApiKeyRow, 'nonce' | 'tag'>;

@Injectable()
export class ApiKeyService {
  private readonly logger = new Logger(ApiKeyService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly publicKeyService: PublicKeyService,
  ) {}

  create(dto: CreateApiKeyDto, userId: string) {
    // RSA 解密前端密文得到明文，仅此一次返回给客户端，此后只存 AES 密文
    let plaintextApiKey: string;
    try {
      plaintextApiKey = this.publicKeyService.decrypt(dto.apiKey);
    } catch {
      throw new BadRequestException('apiKey解密失败，请重试');
    }
    this.logger.log(`创建 API Key: ${dto.provider}/${dto.name}`);
    // AES 主密钥为 hex 编码的 32 字节（.env: AES_ENCRYPTION_KEY）
    const aesKeyHex = process.env.AES_ENCRYPTION_KEY;
    if (!aesKeyHex) throw new Error('AES_ENCRYPTION_KEY 未配置');
    const { cipherText, nonce, tag } = this.publicKeyService.aesGcmEncrypt(
      plaintextApiKey,
      Buffer.from(aesKeyHex, 'hex'),
    );
    return this.prisma.apiKey
      .create({
        data: { ...dto, apiKey: cipherText, nonce, tag, createdBy: userId },
      })
      .then((row) => this.toPublic(row, plaintextApiKey));
  }

  findAll() {
    return this.prisma.apiKey
      .findMany()
      .then((rows) => rows.map((row) => this.toPublic(row)));
  }

  findOne(id: string) {
    return this.prisma.apiKey
      .findUnique({ where: { id } })
      .then((row) => (row ? this.toPublic(row) : null));
  }

  update(id: string, updateApiKeyDto: UpdateApiKeyDto) {
    return this.prisma.apiKey
      .update({ where: { id }, data: updateApiKeyDto })
      .then((row) => this.toPublic(row));
  }

  remove(id: string) {
    return this.prisma.apiKey
      .delete({ where: { id } })
      .then((row) => this.toPublic(row));
  }

  /**
   * 转为对外安全结构：
   * - plaintext 传入（仅创建响应）→ apiKey 为完整明文，仅展示一次
   * - 否则解密后脱敏，例如 sk-a****f3a2
   * - 统一剔除 nonce/tag
   */
  private toPublic(row: ApiKeyRow, plaintext?: string): ApiKeyPublic {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { nonce, tag, ...rest } = row;
    return { ...rest, apiKey: plaintext ?? this.maskFromRow(row) };
  }

  /** 解密并脱敏；解密失败（密钥变更/数据损坏）时兜底为 ****，不阻断列表 */
  private maskFromRow(row: ApiKeyRow): string {
    const aesKeyHex = process.env.AES_ENCRYPTION_KEY;
    if (!aesKeyHex) return '****';
    try {
      const plain = this.publicKeyService.aesGcmDecrypt(
        { cipherText: row.apiKey, nonce: row.nonce, tag: row.tag },
        Buffer.from(aesKeyHex, 'hex'),
      );
      return this.mask(plain);
    } catch {
      return '****';
    }
  }

  /** 保留首 4 尾 4，中间用 **** 遮盖 */
  private mask(plaintext: string): string {
    if (plaintext.length <= 8) return '****';
    return `${plaintext.slice(0, 4)}****${plaintext.slice(-4)}`;
  }
}
