import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '@nexus/database';
import { CreatePromptTemplateDto } from './dto/create-prompt_template.dto';
import { UpdatePromptTemplateDto } from './dto/update-prompt_template.dto';
import type { PromptTemplate, PromptTemplateVersion } from '@prisma/client';

/**
 * 列表/详情行：模板 + 当前版本内容拍平（前端工作区契约）。
 * currentVersionId 在 schema 中是裸 UUID 列（无 relation），这里手动联查。
 */
export interface PromptTemplateRow {
  id: string;
  name: string;
  description: string | null;
  currentVersionId: string | null;
  currentVersionNumber: number | null;
  versionCount: number;
  content: string | null;
  variables: string[];
  createdAt: Date;
  updatedAt: Date;
}

type TemplateWithCount = PromptTemplate & {
  _count: { versions: number };
};

/** {{ name }} 占位符（允许 \w/. /-，容忍内侧空格），去重保序 */
const VAR_PATTERN = /\{\{\s*([\w.-]+)\s*\}\}/g;

@Injectable()
export class PromptTemplateService {
  constructor(private readonly prisma: PrismaService) {}

  extractVariables(content: string): string[] {
    const seen = new Set<string>();
    for (const m of content.matchAll(VAR_PATTERN)) {
      const v = m[1];
      if (v && !seen.has(v)) seen.add(v);
    }
    return [...seen];
  }

  private parseVariables(raw: unknown): string[] {
    if (!Array.isArray(raw)) return [];
    return raw.filter((v): v is string => typeof v === 'string');
  }

  private toRow(
    t: TemplateWithCount,
    current: PromptTemplateVersion | undefined,
  ): PromptTemplateRow {
    return {
      id: t.id,
      name: t.name,
      description: t.description,
      currentVersionId: t.currentVersionId,
      currentVersionNumber: current?.versionNumber ?? null,
      versionCount: t._count.versions,
      content: current?.content ?? null,
      variables: this.parseVariables(current?.variables),
      createdAt: t.createdAt,
      updatedAt: t.updatedAt,
    };
  }

  async findAll(): Promise<PromptTemplateRow[]> {
    const templates = await this.prisma.promptTemplate.findMany({
      orderBy: { updatedAt: 'desc' },
      include: { _count: { select: { versions: true } } },
    });
    const currentIds = templates
      .map((t) => t.currentVersionId)
      .filter((x): x is string => !!x);
    const currents = currentIds.length
      ? await this.prisma.promptTemplateVersion.findMany({
          where: { id: { in: currentIds } },
        })
      : [];
    const byId = new Map(currents.map((v) => [v.id, v]));
    return templates.map((t) =>
      this.toRow(
        t,
        t.currentVersionId ? byId.get(t.currentVersionId) : undefined,
      ),
    );
  }

  async findOne(id: string): Promise<PromptTemplateRow> {
    const t = await this.prisma.promptTemplate.findUnique({
      where: { id },
      include: { _count: { select: { versions: true } } },
    });
    if (!t) throw new NotFoundException('提示词模板不存在');
    const current = t.currentVersionId
      ? await this.prisma.promptTemplateVersion.findUnique({
          where: { id: t.currentVersionId },
        })
      : null;
    return this.toRow(t, current ?? undefined);
  }

  /** 版本历史（新→旧），「当前」由前端对照 currentVersionId 标记 */
  async listVersions(id: string) {
    const exists = await this.prisma.promptTemplate.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!exists) throw new NotFoundException('提示词模板不存在');
    const versions = await this.prisma.promptTemplateVersion.findMany({
      where: { templateId: id },
      orderBy: { versionNumber: 'desc' },
      include: { createdByUser: { select: { username: true } } },
    });
    return versions.map(({ createdByUser, ...rest }) => ({
      ...rest,
      variables: this.parseVariables(rest.variables),
      createdByName: createdByUser?.username ?? null,
    }));
  }

  async create(dto: CreatePromptTemplateDto, userId: string) {
    const variables = this.extractVariables(dto.content);
    try {
      const created = await this.prisma.$transaction(async (tx) => {
        const template = await tx.promptTemplate.create({
          data: { name: dto.name, description: dto.description },
        });
        const version = await tx.promptTemplateVersion.create({
          data: {
            templateId: template.id,
            versionNumber: 1,
            content: dto.content,
            variables,
            isActive: true,
            createdBy: userId,
          },
        });
        return tx.promptTemplate.update({
          where: { id: template.id },
          data: { currentVersionId: version.id },
        });
      });
      return this.findOne(created.id);
    } catch (e) {
      if (this.prismaErrorCode(e) === 'P2002') {
        throw new ConflictException('提示词名称已存在');
      }
      throw e;
    }
  }

  /**
   * 正文变更 ⇒ 自动创建新版本（version_number+1、current_version_id 指向新版本），
   * 对齐 DATABASE.md「变即打版本, 不影响历史会话」；正文未变 ⇒ 仅更新元信息。
   */
  async update(id: string, dto: UpdatePromptTemplateDto, userId: string) {
    const existing = await this.prisma.promptTemplate.findUnique({
      where: { id },
    });
    if (!existing) throw new NotFoundException('提示词模板不存在');

    const latest = await this.prisma.promptTemplateVersion.findFirst({
      where: { templateId: id },
      orderBy: { versionNumber: 'desc' },
      select: { versionNumber: true, content: true },
    });

    const meta: { name?: string; description?: string } = {};
    if (dto.name !== undefined) meta.name = dto.name;
    if (dto.description !== undefined) meta.description = dto.description;

    const contentChanged =
      dto.content !== undefined && dto.content !== (latest?.content ?? null);

    try {
      if (!contentChanged) {
        await this.prisma.promptTemplate.update({ where: { id }, data: meta });
      } else {
        const variables = this.extractVariables(dto.content as string);
        await this.prisma.$transaction(async (tx) => {
          const version = await tx.promptTemplateVersion.create({
            data: {
              templateId: id,
              versionNumber: (latest?.versionNumber ?? 0) + 1,
              content: dto.content as string,
              variables,
              isActive: true,
              createdBy: userId,
            },
          });
          await tx.promptTemplate.update({
            where: { id },
            data: { ...meta, currentVersionId: version.id },
          });
        });
      }
    } catch (e) {
      if (this.prismaErrorCode(e) === 'P2002') {
        throw new ConflictException('提示词名称已存在');
      }
      throw e;
    }
    return this.findOne(id);
  }

  /**
   * 删除模板：版本随 ON DELETE CASCADE 一并删除；
   * ai_applications.prompt_template_id 为 SetNull，引用自动解除。
   */
  async remove(id: string) {
    try {
      await this.prisma.promptTemplate.delete({ where: { id } });
    } catch (e) {
      if (this.prismaErrorCode(e) === 'P2025') {
        throw new NotFoundException('提示词模板不存在');
      }
      throw e;
    }
    return { id, deleted: true };
  }

  private prismaErrorCode(e: unknown): string | undefined {
    if (e && typeof e === 'object' && 'code' in e) {
      return (e as { code?: string }).code;
    }
    return undefined;
  }
}
