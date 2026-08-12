import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@nexus/database';
import { CreateVersionDto } from './dto/create-version.dto';
import { UpdateVersionDto } from './dto/update-version.dto';

/**
 * 版本服务
 *
 * 提供文档版本的查询和管理
 * 主要版本操作（创建、激活）已集成在 DocumentService 中
 * 此模块提供独立的版本查询和管理 API
 */
@Injectable()
export class VersionService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * 创建独立版本记录（通常由 DocumentService.saveMeta 内部调用）
   */
  async create(dto: CreateVersionDto) {
    return this.prisma.documentVersion.create({
      data: dto,
    });
  }

  /**
   * 查询所有版本
   */
  async findAll() {
    return this.prisma.documentVersion.findMany({
      include: {
        document: { select: { id: true, name: true, kbId: true } },
        createdByUser: { select: { id: true, username: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * 查询单个版本详情
   */
  async findOne(id: string) {
    const version = await this.prisma.documentVersion.findUnique({
      where: { id },
      include: {
        document: { select: { id: true, name: true, kbId: true } },
        createdByUser: { select: { id: true, username: true } },
      },
    });

    if (!version) {
      throw new NotFoundException('版本不存在');
    }

    return version;
  }

  /**
   * 更新版本信息
   */
  async update(id: string, dto: UpdateVersionDto) {
    const version = await this.prisma.documentVersion.findUnique({
      where: { id },
    });

    if (!version) {
      throw new NotFoundException('版本不存在');
    }

    return this.prisma.documentVersion.update({
      where: { id },
      data: dto,
    });
  }

  /**
   * 删除版本记录
   */
  async remove(id: string) {
    const version = await this.prisma.documentVersion.findUnique({
      where: { id },
    });

    if (!version) {
      throw new NotFoundException('版本不存在');
    }

    return this.prisma.documentVersion.delete({
      where: { id },
    });
  }

  /**
   * 查询指定文档的所有版本
   */
  async findByDocumentId(documentId: string) {
    return this.prisma.documentVersion.findMany({
      where: { documentId },
      include: {
        createdByUser: { select: { id: true, username: true } },
      },
      orderBy: { versionNumber: 'desc' },
    });
  }
}
