import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Query,
} from '@nestjs/common';
import { DocumentService } from './document.service';
import { CreateDocumentDto } from './dto/create-document.dto';
import { UpdateDocumentDto } from './dto/update-document.dto';
import { ActivateVersionDto } from './dto/document.dto';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import type { JwtPayload } from '../../../common/decorators/current-user.decorator';
import { KbPermissionGuard } from '../../../common/guards/kb-permission.guard';

/**
 * 文档控制器
 *
 * 路由前缀：/api/v1/knowledge-bases/:kbId/documents
 *
 * 安全：
 * - 全局 AuthGuard：JWT 登录鉴权
 * - 写操作使用 KbPermissionGuard：admin/editor 权限
 * - 预览 URL 通过后端生成临时签名 URL
 */
@Controller('knowledge-bases/:kbId/documents')
export class DocumentController {
  constructor(private readonly documentService: DocumentService) {}

  /**
   * POST /api/v1/knowledge-bases/:kbId/documents/save-meta
   *
   * 上传完成后回写元数据 + 版本记录
   *
   * 权限：admin / editor
   * 二次校验 kbId 防止前端伪造
   */
  @Post('save-meta')
  @UseGuards(KbPermissionGuard)
  async saveMeta(
    @Param('kbId') kbId: string,
    @Body() dto: CreateDocumentDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.documentService.saveMeta(kbId, user.sub, dto);
  }

  /**
   * GET /api/v1/knowledge-bases/:kbId/documents
   *
   * 获取知识库下文档列表
   */
  @Get()
  async findByKbId(
    @Param('kbId') kbId: string,
    @Query('status') status?: string,
  ) {
    return this.documentService.findByKbId(kbId, { status });
  }

  /**
   * GET /api/v1/knowledge-bases/:kbId/documents/:id
   *
   * 获取文档详情
   */
  @Get(':id')
  async findOne(
    @Param('kbId') kbId: string,
    @Param('id') id: string,
  ) {
    return this.documentService.findOne(kbId, id);
  }

  /**
   * PATCH /api/v1/knowledge-bases/:kbId/documents/:id
   *
   * 更新文档信息
   *
   * 权限：admin / editor
   */
  @Patch(':id')
  @UseGuards(KbPermissionGuard)
  async update(
    @Param('kbId') kbId: string,
    @Param('id') id: string,
    @Body() dto: UpdateDocumentDto,
  ) {
    return this.documentService.update(kbId, id, dto);
  }

  /**
   * DELETE /api/v1/knowledge-bases/:kbId/documents/:id
   *
   * 软删除文档（status → DELETED）
   *
   * 权限：admin / editor
   */
  @Delete(':id')
  @UseGuards(KbPermissionGuard)
  async remove(
    @Param('kbId') kbId: string,
    @Param('id') id: string,
  ) {
    return this.documentService.softDelete(kbId, id);
  }

  /**
   * GET /api/v1/knowledge-bases/:kbId/documents/:id/versions
   *
   * 获取文档版本历史
   */
  @Get(':id/versions')
  async getVersionHistory(
    @Param('kbId') kbId: string,
    @Param('id') id: string,
  ) {
    return this.documentService.getVersionHistory(kbId, id);
  }

  /**
   * PATCH /api/v1/knowledge-bases/:kbId/documents/:id/activate-version
   *
   * 切换当前活跃版本
   *
   * 权限：admin / editor
   */
  @Patch(':id/activate-version')
  @UseGuards(KbPermissionGuard)
  async activateVersion(
    @Param('kbId') kbId: string,
    @Param('id') id: string,
    @Body() dto: ActivateVersionDto,
  ) {
    return this.documentService.activateVersion(kbId, id, dto.versionId);
  }

  /**
   * GET /api/v1/knowledge-bases/:kbId/documents/:id/download-url
   *
   * 获取文件预签名下载/预览 URL
   */
  @Get(':id/download-url')
  async getDownloadUrl(
    @Param('kbId') kbId: string,
    @Param('id') id: string,
    @Query('versionId') versionId?: string,
  ) {
    return this.documentService.getDownloadUrl(kbId, id, versionId);
  }
}
