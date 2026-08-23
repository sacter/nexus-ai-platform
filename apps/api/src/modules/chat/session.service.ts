import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@nexus/database';
import { DEFAULT_WORKFLOW_TYPE } from '@nexus/config';
import { CreateSessionDto } from './dto/create-session.dto';

@Injectable()
export class SessionService {
  constructor(private prisma: PrismaService) {}

  async create(dto: CreateSessionDto, userId: string) {
    // workflowType 以后端为准：选了工作流就用它的 type（DTO 不含 workflowType，
    // 前端直传的值会被 ValidationPipe whitelist 剥离，到不了这里）
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
    return this.prisma.chatSession.create({
      data: { ...dto, userId, workflowType },
    });
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
