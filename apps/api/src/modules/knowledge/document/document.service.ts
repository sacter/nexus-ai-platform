import {
  Injectable,
  NotFoundException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import type { Queue } from 'bullmq';
import { PrismaService } from '../../../infrastructure/database/prisma/prisma.service';
import { MinioService } from '../../../infrastructure/minio/minio.service';
import { QUEUE_NAMES } from '../../../infrastructure/queue/queue.constants';
import { CreateDocumentDto } from './dto/create-document.dto';
import { UpdateDocumentDto } from './dto/update-document.dto';
import type { DocumentStatus, Prisma } from '@prisma/client';

/**
 * 文档服务
 *
 * 核心业务逻辑：
 * - 上传后回写元数据（含版本号递增逻辑）
 * - 知识库内文档 CRUD
 * - 软删除（status → DELETED）
 * - 活跃版本切换（替换 current_version_id 指向）
 * - 版本历史查询
 * - MinIO 预签名 URL 生成
 */
@Injectable()
export class DocumentService {
  private readonly logger = new Logger(DocumentService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly minioService: MinioService,
    @InjectQueue(QUEUE_NAMES.INDEX) private readonly indexQueue: Queue,
    @InjectQueue(QUEUE_NAMES.DELETE_CHUNKS) private readonly deleteChunksQueue: Queue,
    @InjectQueue(QUEUE_NAMES.CLEANUP) private readonly cleanupQueue: Queue,
    @InjectQueue(QUEUE_NAMES.REINDEX) private readonly reindexQueue: Queue,
  ) {}

  /**
   * 上传完成后回写元数据 + 版本记录
   *
   * 版本规则：
   * - 同一知识库、同一个 name → 版本号递增（同组文件）
   * - 不同知识库、相同 name → 相互独立，各自从 1 开始
   * - 事务包裹，防止文件上传成功但数据库写入失败
   * - 幂等键防重复创建版本
   */
  async saveMeta(kbId: string, userId: string, dto: CreateDocumentDto) {
    const result = await this.prisma.$transaction(async (tx) => {
      // 幂等检查：如果提供了 idempotencyKey，检查是否已存在
      if (dto.idempotencyKey) {
        const existingVersion = await tx.documentVersion.findFirst({
          where: {
            document: { kbId },
            fileUrl: dto.url,
          },
        });
        if (existingVersion) {
          this.logger.warn(
            `Duplicate upload detected: idempotencyKey=${dto.idempotencyKey}, url=${dto.url}`,
          );
          throw new ConflictException('该文件已上传，请勿重复提交');
        }
      }

      // 查找同一知识库下、同一 name 的文档（判断是否同组版本）
      const existingDoc = await tx.document.findFirst({
        where: { kbId, name: dto.name },
        include: {
          versions: {
            orderBy: { versionNumber: 'desc' },
            take: 1,
          },
        },
      });

      if (existingDoc) {
        // --- 已有同 name 文档 → 新增版本 ---
        const nextVersion = (existingDoc.versions[0]?.versionNumber || 0) + 1;

        const newVersion = await tx.documentVersion.create({
          data: {
            documentId: existingDoc.id,
            versionNumber: nextVersion,
            fileUrl: dto.url,
            pageCount: dto.pageCount || 0,
            chunkCount: 0,
            status: 'PROCESSING',
            changeSummary: `上传新版本 v${nextVersion}`,
            createdBy: userId,
          },
        });

        // 更新文档主表的 current_version_id 和文件信息
        const updated = await tx.document.update({
          where: { id: existingDoc.id },
          data: {
            currentVersionId: newVersion.id,
            originalName: dto.originalName,
            url: dto.url,
            fileSize: dto.fileSize,
            mimeType: dto.mimeType,
            pageCount: dto.pageCount || 0,
            status: 'UPLOADING',
            updatedAt: new Date(),
          },
        });

        this.logger.log(
          `Document version incremented: ${dto.name} → v${nextVersion}, docId=${existingDoc.id}`,
        );

        return { document: updated, version: newVersion, isNew: false };
      }

      // --- 新文档 + v1 版本 ---
      const newDoc = await tx.document.create({
        data: {
          kbId,
          userId,
          name: dto.name,
          originalName: dto.originalName,
          url: dto.url,
          fileSize: dto.fileSize,
          mimeType: dto.mimeType,
          pageCount: dto.pageCount || 0,
          status: 'UPLOADING',
          chunkCount: 0,
        },
      });

      const newVersion = await tx.documentVersion.create({
        data: {
          documentId: newDoc.id,
          versionNumber: 1,
          fileUrl: dto.url,
          pageCount: dto.pageCount || 0,
          chunkCount: 0,
          status: 'PROCESSING',
          changeSummary: '初始版本 v1',
          createdBy: userId,
        },
      });

      await tx.document.update({
        where: { id: newDoc.id },
        data: { currentVersionId: newVersion.id },
      });

      this.logger.log(`New document created: ${dto.name}, docId=${newDoc.id}`);

      return {
        document: { ...newDoc, currentVersionId: newVersion.id },
        version: newVersion,
        isNew: true,
      };
    });

    // ★ 功能：直接入队 index Queue（独立 Worker 消费）
    await this.indexQueue.add('index-document', {
      documentId: result.document.id,
      versionId: result.version.id,
      kbId,
    });
    this.logger.log(`Enqueued index job: doc=${result.document.id}`);

    return result;
  }

  /**
   * 查询知识库下的文档列表
   *
   * 提供 page/pageSize 时返回分页 envelope { items, total, page, pageSize }
   * （对齐 ChunkService.listChunks 口径）；未提供时返回全量数组（向后兼容：
   * ChunkDetail 文档选择器 / DocumentUpload 版本分组依赖全量数据）。
   */
  async findByKbId(
    kbId: string,
    params?: {
      status?: DocumentStatus;
      page?: number;
      pageSize?: number;
      keyword?: string;
    },
  ) {
    const keyword = params?.keyword?.trim();
    const where: Prisma.DocumentWhereInput = {
      kbId,
      ...(params?.status
        ? { status: params.status }
        : { status: { not: 'DELETED' } }),
      ...(keyword ? { name: { contains: keyword, mode: 'insensitive' } } : {}),
    };

    const include = {
      currentVersion: {
        select: { id: true, versionNumber: true, status: true },
      },
      user: { select: { id: true, username: true } },
    } satisfies Prisma.DocumentInclude;

    // 分页参数缺失 → 返回全量数组（向后兼容）
    if (!Number.isFinite(params?.page) || !Number.isFinite(params?.pageSize)) {
      return this.prisma.document.findMany({
        where,
        include,
        orderBy: { createdAt: 'desc' },
      });
    }

    const page = Math.max(1, Math.floor(params!.page!));
    const pageSize = Math.min(100, Math.max(1, Math.floor(params!.pageSize!)));

    const [total, items] = await this.prisma.$transaction([
      this.prisma.document.count({ where }),
      this.prisma.document.findMany({
        where,
        include,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);

    return { items, total, page, pageSize };
  }

  /**
   * 查询单个文档详情（含当前活跃版本）
   */
  async findOne(kbId: string, docId: string) {
    const doc = await this.prisma.document.findFirst({
      where: { id: docId, kbId },
      include: {
        currentVersion: true,
        user: {
          select: { id: true, username: true },
        },
      },
    });

    if (!doc) {
      throw new NotFoundException('文档不存在');
    }

    return doc;
  }

  /**
   * 更新文档信息
   */
  async update(kbId: string, docId: string, dto: UpdateDocumentDto) {
    const doc = await this.prisma.document.findFirst({
      where: { id: docId, kbId },
    });

    if (!doc) {
      throw new NotFoundException('文档不存在');
    }

    return this.prisma.document.update({
      where: { id: docId },
      data: dto,
    });
  }

  /**
   * 软删除：修改 status 为 DELETED
   *
   * 不删除 MinIO 文件，保留文件追踪能力
   * 彻底删除时需遍历所有版本的 object 调用 MinIO 删除
   */
  async softDelete(kbId: string, docId: string) {
    const doc = await this.prisma.document.findFirst({
      where: { id: docId, kbId },
    });

    if (!doc) {
      throw new NotFoundException('文档不存在');
    }

    const updated = await this.prisma.document.update({
      where: { id: docId },
      data: { status: 'DELETED', updatedAt: new Date() },
    });

    // ★ 功能4：直接入队 GC Queue（独立 Worker 消费）
    await this.deleteChunksQueue.add('delete-chunks', {
      documentId: doc.id,
      kbId: doc.kbId,
    });
    await this.cleanupQueue.add('cleanup-document', {
      documentId: doc.id,
      kbId: doc.kbId,
    });
    return updated;
  }

  /**
   * 彻底删除：删除数据库记录 + MinIO 上所有版本文件
   */
  async hardDelete(kbId: string, docId: string) {
    const doc = await this.prisma.document.findFirst({
      where: { id: docId, kbId },
      include: { versions: { select: { fileUrl: true } } },
    });

    if (!doc) {
      throw new NotFoundException('文档不存在');
    }

    // 删除 MinIO 上所有版本文件
    const objectKeys = doc.versions.map((v) => v.fileUrl);
    await this.minioService.deleteObjects(objectKeys);

    // 级联删除数据库记录（Prisma schema 已配置 ON DELETE CASCADE）
    return this.prisma.document.delete({
      where: { id: docId },
    });
  }

  /**
   * 切换当前活跃版本
   *
   * 只替换 document.current_version_id 指向历史版本
   * 不重新上传文件
   */
  async activateVersion(kbId: string, docId: string, versionId: string) {
    // 验证版本属于该文档
    const version = await this.prisma.documentVersion.findFirst({
      where: { id: versionId, documentId: docId },
    });

    if (!version) {
      throw new NotFoundException('版本不存在或不属于该文档');
    }

    const doc = await this.prisma.document.findFirst({
      where: { id: docId, kbId },
    });

    if (!doc) {
      throw new NotFoundException('文档不存在');
    }

    const updated = await this.prisma.document.update({
      where: { id: docId },
      data: {
        currentVersionId: versionId,
        url: version.fileUrl,
        pageCount: version.pageCount,
        chunkCount: version.chunkCount,
        updatedAt: new Date(),
      },
    });

    this.logger.log(
      `Version activated: docId=${docId}, versionId=${versionId} → v${version.versionNumber}`,
    );

    return updated;
  }

  /**
   * 获取文档的所有版本历史
   */
  async getVersionHistory(kbId: string, docId: string) {
    const doc = await this.prisma.document.findFirst({
      where: { id: docId, kbId },
    });

    if (!doc) {
      throw new NotFoundException('文档不存在');
    }

    return this.prisma.documentVersion.findMany({
      where: { documentId: docId },
      include: {
        createdByUser: {
          select: { id: true, username: true },
        },
      },
      orderBy: { versionNumber: 'desc' },
    });
  }

  /**
   * 获取文件预签名下载/预览 URL
   *
   * 安全要求：桶私有，所有访问通过临时签名 URL
   * 禁止直接返回 MinIO 原始地址给前端
   */
  async getDownloadUrl(kbId: string, docId: string, versionId?: string) {
    let objectKey: string;

    if (versionId) {
      const version = await this.prisma.documentVersion.findFirst({
        where: { id: versionId, documentId: docId },
      });
      if (!version) {
        throw new NotFoundException('版本不存在');
      }
      objectKey = version.fileUrl;
    } else {
      const doc = await this.prisma.document.findFirst({
        where: { id: docId, kbId },
      });
      if (!doc) {
        throw new NotFoundException('文档不存在');
      }
      objectKey = doc.url;
    }

    const presignedUrl =
      await this.minioService.generatePresignedDownloadUrl(objectKey);

    return { url: presignedUrl, objectKey, expiresIn: 3600 };
  }

  /**
   * 重新索引（重新 embedding）：发布 index.requested → Reindex Worker
   */
  async requestReindex(kbId: string, docId: string) {
    const doc = await this.prisma.document.findFirst({
      where: { id: docId, kbId, status: { not: 'DELETED' } },
    });
    if (!doc) throw new NotFoundException('文档不存在或已删除');
    if (!doc.currentVersionId)
      throw new ConflictException('文档没有活跃版本，无法重新索引');

    // ★ 直接入队 reindex Queue（独立 Worker 消费）
    await this.reindexQueue.add('reindex-document', {
      documentId: docId,
      versionId: doc.currentVersionId,
      kbId,
    });
    return { reindexed: true, versionId: doc.currentVersionId };
  }
}
