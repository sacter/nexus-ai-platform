import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '@nexus/database';
import { ApplicationStatus, Prisma } from '@prisma/client';
import { CreateAiApplicationDto } from './dto/create-ai-application.dto';
import { UpdateAiApplicationDto } from './dto/update-ai-application.dto';
import { BindToolDto } from './dto/bind-tool.dto';

/** 列表/详情联查绑定资源名称（前端配方条/装配图契约，见 DATABASE.md 6.4/6.5） */
const APP_INCLUDE = {
  kb: { select: { id: true, name: true } },
  workflow: { select: { id: true, name: true, type: true } },
  model: { select: { id: true, displayName: true, provider: true } },
  promptTemplate: { select: { id: true, name: true } },
  tools: {
    orderBy: { createdAt: 'asc' as const },
    include: {
      tool: {
        select: {
          id: true,
          name: true,
          displayName: true,
          type: true,
          description: true,
        },
      },
    },
  },
} as const;

type AppRow = Prisma.AiApplicationGetPayload<{ include: typeof APP_INCLUDE }>;

/** 应用绑定的工具（拍平 junction 一层，config 为应用级覆盖） */
interface AppToolPublic {
  toolId: string;
  name: string;
  displayName: string;
  type: string;
  description: string | null;
  config: unknown;
}

/** 对外结构：嵌套资源对象扁平化为名称字段 */
export type AiApplicationPublic = Omit<
  AppRow,
  'kb' | 'workflow' | 'model' | 'promptTemplate' | 'tools'
> & {
  kbName: string;
  workflowName: string;
  workflowType: string;
  modelDisplayName: string;
  modelProvider: string;
  promptTemplateName: string | null;
  tools: AppToolPublic[];
};

@Injectable()
export class AiApplicationService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(): Promise<AiApplicationPublic[]> {
    const rows = await this.prisma.aiApplication.findMany({
      include: APP_INCLUDE,
      orderBy: { updatedAt: 'desc' },
    });
    return rows.map((row) => this.toPublic(row));
  }

  async findOne(id: string): Promise<AiApplicationPublic> {
    const row = await this.prisma.aiApplication.findUnique({
      where: { id },
      include: APP_INCLUDE,
    });
    if (!row) throw new NotFoundException('AI 应用不存在');
    return this.toPublic(row);
  }

  async create(
    dto: CreateAiApplicationDto,
    userId: string,
  ): Promise<AiApplicationPublic> {
    await this.assertRefsExist(dto);
    this.validateConfig(dto.config ?? {});
    const tools = await this.assertToolsExist(dto.toolIds);

    // 应用 + 工具绑定同一事务，避免留下未装配的应用
    const created = await this.prisma.$transaction(async (tx) => {
      const app = await tx.aiApplication.create({
        data: {
          name: dto.name,
          description: dto.description,
          icon: dto.icon ?? 'bot',
          knowledgeBaseId: dto.knowledgeBaseId,
          workflowId: dto.workflowId,
          modelId: dto.modelId,
          promptTemplateId: dto.promptTemplateId ?? null,
          status: dto.status ?? ApplicationStatus.draft,
          config: (dto.config ?? {}) as Prisma.InputJsonObject,
          createdBy: userId,
        },
      });
      if (tools?.length) {
        await tx.aiApplicationTool.createMany({
          data: tools.map((t) => ({ applicationId: app.id, toolId: t.id })),
        });
      }
      return app;
    });
    return this.findOne(created.id);
  }

  async update(
    id: string,
    dto: UpdateAiApplicationDto,
  ): Promise<AiApplicationPublic> {
    const existing = await this.prisma.aiApplication.findUnique({
      where: { id },
    });
    if (!existing) throw new NotFoundException('AI 应用不存在');

    // 合并新旧值校验引用，避免只改部分字段时绕过外键检查
    await this.assertRefsExist({ ...existing, ...dto });
    if (dto.config) this.validateConfig(dto.config);
    const tools = await this.assertToolsExist(dto.toolIds);

    // toolIds 是关联表数据，不能透传到 aiApplication.update
    const { toolIds, ...rest } = dto;
    const data: Prisma.AiApplicationUpdateInput = {
      ...rest,
      config: rest.config as Prisma.InputJsonObject | undefined,
    };

    if (tools === undefined) {
      await this.prisma.aiApplication.update({ where: { id }, data });
    } else {
      // 工具绑定整体替换：更新 + 重绑同一事务，避免半装配状态
      await this.prisma.$transaction(async (tx) => {
        await tx.aiApplication.update({ where: { id }, data });
        await tx.aiApplicationTool.deleteMany({
          where: { applicationId: id },
        });
        if (tools.length) {
          await tx.aiApplicationTool.createMany({
            data: tools.map((t) => ({ applicationId: id, toolId: t.id })),
          });
        }
      });
    }
    return this.findOne(id);
  }

  async remove(id: string): Promise<{ id: string }> {
    try {
      await this.prisma.aiApplication.delete({ where: { id } });
      return { id };
    } catch (e) {
      // P2025: 目标不存在；P2003: 被 chat_sessions / workflow_executions 以 Restrict 引用
      if (this.prismaErrorCode(e) === 'P2025') {
        throw new NotFoundException('AI 应用不存在');
      }
      if (this.prismaErrorCode(e) === 'P2003') {
        throw new ConflictException('该应用已被会话或执行记录引用，无法删除');
      }
      throw e;
    }
  }

  async bindTool(id: string, dto: BindToolDto): Promise<AiApplicationPublic> {
    const app = await this.prisma.aiApplication.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!app) throw new NotFoundException('AI 应用不存在');
    const tool = await this.prisma.tool.findUnique({
      where: { id: dto.toolId },
      select: { id: true },
    });
    if (!tool) throw new NotFoundException('工具不存在');
    const bound = await this.prisma.aiApplicationTool.findUnique({
      where: { applicationId_toolId: { applicationId: id, toolId: dto.toolId } },
      select: { id: true },
    });
    if (bound) throw new ConflictException('工具已绑定');
    await this.prisma.aiApplicationTool.create({
      data: {
        applicationId: id,
        toolId: dto.toolId,
        config: (dto.config ?? {}) as Prisma.InputJsonObject,
      },
    });
    return this.findOne(id);
  }

  async unbindTool(id: string, toolId: string): Promise<{ toolId: string }> {
    try {
      await this.prisma.aiApplicationTool.delete({
        where: { applicationId_toolId: { applicationId: id, toolId } },
      });
      return { toolId };
    } catch (e) {
      if (this.prismaErrorCode(e) === 'P2025') {
        throw new NotFoundException('工具未绑定');
      }
      throw e;
    }
  }

  /** 外键 Restrict 校验：绑定的资源必须存在（promptTemplateId 可空，null = 系统默认） */
  private async assertRefsExist(refs: {
    knowledgeBaseId?: string;
    workflowId?: string;
    modelId?: string;
    promptTemplateId?: string | null;
  }) {
    const checks: [Promise<{ id: string } | null>, string][] = [];
    if (refs.knowledgeBaseId) {
      checks.push([
        this.prisma.knowledgeBase.findUnique({
          where: { id: refs.knowledgeBaseId },
          select: { id: true },
        }),
        '知识库不存在',
      ]);
    }
    if (refs.workflowId) {
      checks.push([
        this.prisma.workflow.findUnique({
          where: { id: refs.workflowId },
          select: { id: true },
        }),
        '工作流不存在',
      ]);
    }
    if (refs.modelId) {
      checks.push([
        this.prisma.model.findUnique({
          where: { id: refs.modelId },
          select: { id: true },
        }),
        '模型不存在',
      ]);
    }
    if (refs.promptTemplateId) {
      checks.push([
        this.prisma.promptTemplate.findUnique({
          where: { id: refs.promptTemplateId },
          select: { id: true },
        }),
        'Prompt 模板不存在',
      ]);
    }
    for (const [promise, message] of checks) {
      if (!(await promise)) throw new NotFoundException(message);
    }
  }

  /** toolIds 未传 → undefined（不动绑定）；传了 → 校验存在并去重 */
  private async assertToolsExist(toolIds?: string[]) {
    if (toolIds === undefined) return undefined;
    const uniqueIds = [...new Set(toolIds)];
    if (!uniqueIds.length) return [];
    const tools = await this.prisma.tool.findMany({
      where: { id: { in: uniqueIds } },
      select: { id: true },
    });
    if (tools.length !== uniqueIds.length) {
      throw new NotFoundException('工具不存在');
    }
    return tools;
  }

  /** 运行配置轻量校验（config 为自由 JsonB，只校验 DATABASE.md 4.18 约定的四个键） */
  private validateConfig(config: Record<string, unknown>) {
    const { temperature, maxTokens, welcomeMessage, suggestedQuestions } =
      config;
    if (temperature !== undefined) {
      if (
        typeof temperature !== 'number' ||
        !Number.isFinite(temperature) ||
        temperature < 0 ||
        temperature > 2
      ) {
        throw new BadRequestException('temperature 需在 0 ~ 2 之间');
      }
    }
    if (maxTokens !== undefined) {
      if (!Number.isInteger(maxTokens) || (maxTokens as number) <= 0) {
        throw new BadRequestException('maxTokens 需为正整数');
      }
    }
    if (welcomeMessage !== undefined && typeof welcomeMessage !== 'string') {
      throw new BadRequestException('welcomeMessage 需为字符串');
    }
    if (suggestedQuestions !== undefined) {
      if (
        !Array.isArray(suggestedQuestions) ||
        suggestedQuestions.some((q) => typeof q !== 'string')
      ) {
        throw new BadRequestException('suggestedQuestions 需为字符串数组');
      }
    }
  }

  private prismaErrorCode(e: unknown): string | undefined {
    if (e instanceof Prisma.PrismaClientKnownRequestError) return e.code;
    if (e && typeof e === 'object' && 'code' in e) {
      return (e as { code?: unknown }).code as string | undefined;
    }
    return undefined;
  }

  private toPublic(row: AppRow): AiApplicationPublic {
    const { kb, workflow, model, promptTemplate, tools, ...rest } = row;
    return {
      ...rest,
      kbName: kb.name,
      workflowName: workflow.name,
      workflowType: workflow.type,
      modelDisplayName: model.displayName,
      modelProvider: model.provider,
      promptTemplateName: promptTemplate?.name ?? null,
      tools: tools.map((t) => ({
        toolId: t.toolId,
        name: t.tool.name,
        displayName: t.tool.displayName,
        type: t.tool.type,
        description: t.tool.description,
        config: t.config,
      })),
    };
  }
}
