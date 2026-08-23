import { Injectable, NotFoundException } from '@nestjs/common';
import { CreateChatDto } from './dto/create-chat.dto';
import { UpdateChatDto } from './dto/update-chat.dto';
import { PrismaService } from '@nexus/database';
import { RetrievalService } from '../retrieval/retrieval.service';
import { ModelCallerService } from '../model/model-caller.service';
import { SessionLockService } from '../../common/services/session-lock.service';
import { TooManyRequestsException } from '../../common/exceptions/too‑many‑requests.exception';

@Injectable()
export class ChatService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly retrieval: RetrievalService,
    private readonly modelCaller: ModelCallerService,
    private readonly sessionLock: SessionLockService,
  ) {}

  create(createChatDto: CreateChatDto) {
    return 'This action adds a new chat';
  }

  // POST /chat/sessions/:id/messages —— 发送消息
  // TODO: 检索(RetrievalService) → 模型(ModelCallerService) → 持久化 ChatMessage → SSE 流式返回
  sendMessage(id: string, body: { content: string }, userId: string) {
    const lockAcquired = await this.sessionLock.acquire(id);
    if (!lockAcquired) {
      throw new TooManyRequestsException('会话处理中，请稍候');
    }
    const session = await this.prisma.chatSession.findFirst({
      where: { id, userId },
      select: { id: true },
    });
    if (!session) {
      throw new NotFoundException('会话不存在');
    }
    const result = await this.retrieval.search({
      query: body.content,
      kbId: session.id,
      strategy: 'vector',
    });
    return `sendMessage ${id} ${body.content}`;
  }
  findAll() {
    return `This action returns all chat`;
  }

  findOne(id: number) {
    return `This action returns a #${id} chat`;
  }

  update(id: number, updateChatDto: UpdateChatDto) {
    return `This action updates a #${id} chat`;
  }

  remove(id: number) {
    return `This action removes a #${id} chat`;
  }
}
