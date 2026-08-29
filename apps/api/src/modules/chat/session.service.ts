import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@nexus/database';
import { DEFAULT_WORKFLOW_TYPE } from '@nexus/config';
import { CreateSessionDto } from './dto/create-session.dto';

@Injectable()
export class SessionService {
  constructor(private prisma: PrismaService) {}

  async create(dto: CreateSessionDto, userId: string) {
    // 快捷模式：选 AI 应用 → 后端把应用绑定快照到会话（session 自包含）
    if (dto.aiApplicationId) {
      const app = await this.prisma.aiApplication.findUnique({
        where: { id: dto.aiApplicationId },
        select: {
          knowledgeBaseId: true,
          workflowId: true,
          modelId: true,
          promptTemplateId: true,
          workflow: { select: { type: true } },
          tools: { select: { toolId: true } },
        },
      });
      if (!app) throw new NotFoundException('AI 应用不存在');
      // 会话 + 工具快照同一事务，避免工具写失败留下孤儿会话
      const [session] = await this.prisma.$transaction(async (tx) => {
        const s = await tx.chatSession.create({
          data: {
            title: dto.title,
            userId,
            aiApplicationId: dto.aiApplicationId,
            kbId: app.knowledgeBaseId,
            workflowId: app.workflowId,
            modelId: app.modelId,
            promptTemplateId: app.promptTemplateId,
            workflowType: app.workflow?.type ?? DEFAULT_WORKFLOW_TYPE,
          },
        });
        if (app.tools.length) {
          await tx.chatSessionTool.createMany({
            data: app.tools.map((t) => ({
              sessionId: s.id,
              toolId: t.toolId,
            })),
          });
        }
        return [s];
      });
      return session;
    }

    // 自定义模式：手动选择 kb/workflow/model/prompt/tools
    let workflowType: string = DEFAULT_WORKFLOW_TYPE;
    if (dto.workflowId) {
      const workflow = await this.prisma.workflow.findUnique({
        where: { id: dto.workflowId },
        select: { type: true },
      });
      if (!workflow) {
        throw new NotFoundException('工作流不存在');
      }
      workflowType = workflow.type;
    }
    // toolIds 是关联表数据，不能透传到 chatSession.create
    const { toolIds, ...sessionData } = dto;
    // 会话 + 工具关联同一事务，toolId 非法（P2003）时整体回滚，避免孤儿会话
    const [session] = await this.prisma.$transaction(async (tx) => {
      const s = await tx.chatSession.create({
        data: { ...sessionData, userId, workflowType },
      });
      if (toolIds?.length) {
        await tx.chatSessionTool.createMany({
          data: toolIds.map((toolId) => ({ sessionId: s.id, toolId })),
        });
      }
      return [s];
    });
    return session;
  }

  findAll(userId: string) {
    return this.prisma.chatSession.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  // GET /chat/sessions/:id/messages —— 会话历史，按创建时间升序（对话流方向）
  async findMessages(sessionId: string, userId: string) {
    const session = await this.prisma.chatSession.findFirst({
      where: { id: sessionId, userId },
      select: { id: true },
    });
    if (!session) {
      throw new NotFoundException('会话不存在');
    }
    return this.prisma.chatMessage.findMany({
      where: { sessionId },
      orderBy: { createdAt: 'asc' },
    });
  }
}
