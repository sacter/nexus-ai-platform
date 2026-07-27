import { Injectable, Logger } from '@nestjs/common';
import * as crypto from 'crypto';

/**
 * RSA-2048 公钥/私钥管理服务
 *
 * 优先从环境变量 RSA_PRIVATE_KEY / RSA_PUBLIC_KEY 读取 PEM 格式密钥，
 * 未设置则启动时自动生成（开发环境便捷）。
 *
 * 生产环境务必通过环境变量注入固定密钥，否则重启后旧公钥失效。
 */
@Injectable()
export class PublicKeyService {
  private readonly logger = new Logger(PublicKeyService.name);
  private readonly privateKey: string;
  readonly publicKey: string;

  constructor() {
    const envPrivate = process.env.RSA_PRIVATE_KEY;
    const envPublic = process.env.RSA_PUBLIC_KEY;

    if (envPrivate && envPublic) {
      // dotenv 将 \n 读取为两个字面字符 \ 和 n，还原为真正的换行符
      this.privateKey = envPrivate.replace(/\\n/g, '\n');
      this.publicKey = envPublic.replace(/\\n/g, '\n');
      this.logger.log('RSA keys loaded from environment variables');
    } else {
      this.logger.warn(
        'RSA keys not found in env, generating ephemeral key pair (OK for dev, SET RSA_PRIVATE_KEY/RSA_PUBLIC_KEY in production)',
      );
      const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
        modulusLength: 2048,
        publicKeyEncoding: { type: 'spki', format: 'pem' },
        privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
      });
      this.publicKey = publicKey;
      this.privateKey = privateKey;
    }
  }

  /**
   * 使用 RSA 私钥解密 Base64 编码的密文
   *
   * @param encryptedBase64 - 前端 JSEncrypt 加密后的 Base64 字符串
   * @returns 解密后的明文字符串
   * @throws 解密失败（密钥不匹配、数据损坏等）
   */
  decrypt(encryptedBase64: string): string {
    return crypto
      .privateDecrypt(
        {
          key: this.privateKey,
          // PKCS#1 v1.5 填充 — 与 jsencrypt 默认行为一致
          padding: crypto.constants.RSA_PKCS1_PADDING,
        },
        Buffer.from(encryptedBase64, 'base64'),
      )
      .toString('utf8');
  }
}
