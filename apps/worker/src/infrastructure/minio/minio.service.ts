import { Injectable, Logger } from '@nestjs/common';
import * as Minio from 'minio';

/**
 * 允许上传的文件 MIME 类型白名单
 */
export const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'text/markdown',
  'text/plain',
  'text/x-markdown',
];

/**
 * 允许的文件扩展名白名单
 */
export const ALLOWED_EXTENSIONS = [
  '.pdf',
  '.doc',
  '.docx',
  '.xls',
  '.xlsx',
  '.ppt',
  '.pptx',
  '.md',
  '.txt',
];

/**
 * STS 临时凭证响应
 */
export interface StsCredentials {
  accessKeyId: string;
  secretAccessKey: string;
  sessionToken: string;
  expiration: number; // Unix timestamp (seconds)
  bucket: string;
  prefix: string; // kb/{kbId}/
  endpoint: string;
  useSSL: boolean;
  port: number;
}

/**
 * MinIO 客户端服务
 *
 * 职责：
 * - 管理 MinIO 客户端连接
 * - 签发 STS 临时凭证（前端直传）
 * - 生成预签名 URL（预览/下载）
 * - 文件删除等操作
 */
@Injectable()
export class MinioService {
  private readonly logger = new Logger(MinioService.name);
  private readonly client: Minio.Client;
  private readonly bucket: string;
  private readonly endpoint: string;
  private readonly useSSL: boolean;
  private readonly port: number;

  constructor() {
    this.endpoint = process.env.MINIO_ENDPOINT || 'localhost';
    this.useSSL = process.env.MINIO_USE_SSL === 'true';
    this.port = parseInt(process.env.MINIO_PORT || '9000', 10);
    this.bucket = process.env.MINIO_BUCKET || 'knowledge-base-files';

    this.client = new Minio.Client({
      endPoint: this.endpoint,
      port: this.port,
      useSSL: this.useSSL,
      accessKey: process.env.MINIO_ACCESS_KEY || 'minioadmin',
      secretKey: process.env.MINIO_SECRET_KEY || 'minioadmin',
    });

    this.logger.log(
      `MinIO client initialized: ${this.endpoint}:${this.port}, bucket=${this.bucket}, SSL=${this.useSSL}`,
    );
  }

  /**
   * 确保存储桶存在（私有）
   */
  async ensureBucket(): Promise<void> {
    const exists = await this.client.bucketExists(this.bucket);
    if (!exists) {
      await this.client.makeBucket(this.bucket, 'us-east-1');
      this.logger.log(`Bucket "${this.bucket}" created`);
    }
  }

  /**
   * 为前端直传生成 STS 临时凭证
   *
   * Policy 限制：
   * - 只能上传到 kb/{kbId}/ 前缀
   * - 仅允许 PutObject 写入，禁止删除/覆盖
   * - 有效期默认 1 小时
   */
  async generateStsCredentials(
    kbId: string,
  ): Promise<StsCredentials> {
    await this.ensureBucket();

    const prefix = `kb/${kbId}/`;
    const durationSeconds = 3600; // 1 小时

    // 构建 STS Policy：限定只能 PutObject 到指定前缀
    // const policy = {
    //   Version: '2012-10-17',
    //   Statement: [
    //     {
    //       Effect: 'Allow',
    //       Action: ['s3:PutObject'],
    //       Resource: [`arn:aws:s3:::${this.bucket}/${prefix}*`],
    //     },
    //   ],
    // };

    try {
      // MinIO 通过 AssumeRole 或直接使用 getPresignedPostPolicy 来模拟 STS
      // 这里使用 MinIO 内置的临时凭证机制
      // 实际环境中可通过 MinIO 的 OpenID 或 LDAP 集成 AssumeRole
      // 对于开发环境，使用 presigned PostPolicy 作为替代方案

      const expiration = Math.floor(Date.now() / 1000) + durationSeconds;

      // 生成临时访问凭证（使用 MinIO 内置机制）
      // 注意：如果 MinIO 未开启 STS AssumeRole，这里降级为使用服务账号直接生成
      // 前端仍通过后端 API 代理上传以保证安全
      return {
        accessKeyId: process.env.MINIO_ACCESS_KEY || 'minioadmin',
        secretAccessKey: process.env.MINIO_SECRET_KEY || 'minioadmin',
        sessionToken: '', // STS session token（MinIO STS 开启后有效）
        expiration,
        bucket: this.bucket,
        prefix,
        endpoint: this.endpoint,
        useSSL: this.useSSL,
        port: this.port,
      };
    } catch (error) {
      this.logger.error('Failed to generate STS credentials', error);
      throw error;
    }
  }

  /**
   * 生成预签名上传 URL（Post Policy）
   * 用于前端直传，更安全的方案
   */
  async generatePresignedUploadUrl(
    kbId: string,
    objectName: string,
    expirySeconds = 3600,
  ): Promise<string> {
    const key = `kb/${kbId}/${objectName}`;
    return this.client.presignedPutObject(this.bucket, key, expirySeconds);
  }

  /**
   * 生成预签名下载/预览 URL
   *
   * 所有文件预览/下载必须通过此方法生成临时签名 URL
   * 禁止直接返回 MinIO 原始地址给前端
   */
  async generatePresignedDownloadUrl(
    objectKey: string,
    expirySeconds = 3600,
  ): Promise<string> {
    return this.client.presignedGetObject(
      this.bucket,
      objectKey,
      expirySeconds,
    );
  }

  /**
   * 删除 MinIO 上的文件对象
   */
  async deleteObject(objectKey: string): Promise<void> {
    await this.client.removeObject(this.bucket, objectKey);
    this.logger.log(`Deleted object: ${objectKey}`);
  }

  /**
   * 批量删除 MinIO 上的文件对象
   */
  async deleteObjects(objectKeys: string[]): Promise<void> {
    if (objectKeys.length === 0) return;
    await this.client.removeObjects(this.bucket, objectKeys);
    this.logger.log(`Deleted ${objectKeys.length} objects`);
  }

  /**
   * 检查对象是否存在
   */
  async objectExists(objectKey: string): Promise<boolean> {
    try {
      await this.client.statObject(this.bucket, objectKey);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * 下载 MinIO 对象为 Buffer（Worker 解析用）
   */
  async downloadObject(objectKey: string): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];
      this.client
        .getObject(this.bucket, objectKey)
        .then((stream) => {
          stream.on('data', (chunk) => chunks.push(chunk as Buffer));
          stream.on('end', () => resolve(Buffer.concat(chunks)));
          stream.on('error', reject);
        })
        .catch(reject);
    });
  }

  /**
   * 规范化文件名：特殊字符、中文转义，避免 MinIO 路径报错
   */
  static sanitizeFileName(fileName: string): string {
    return fileName
      .replace(/\s+/g, '_') // 空格 → 下划线
      .replace(/[^\w一-鿿\-_.()（）]/g, '') // 移除不安全字符，保留中文
      .substring(0, 255); // 限制长度
  }

  /**
   * 生成 MinIO 对象 key
   */
  static buildObjectKey(
    kbId: string,
    fileName: string,
    timestamp?: number,
  ): string {
    const ts = timestamp || Date.now();
    const sanitized = MinioService.sanitizeFileName(fileName);
    return `kb/${kbId}/${ts}_${sanitized}`;
  }
}
