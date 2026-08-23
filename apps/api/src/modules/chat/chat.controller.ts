import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Sse,
  MessageEvent,
  RequestMethod,
  SetMetadata,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { ChatService } from './chat.service';
// import { CreateChatDto } from './dto/create-chat.dto';
import { CreateSessionDto } from './dto/create-session.dto';
import { SendMessageDto } from './dto/send-message.dto';
import { SessionService } from './session.service';
import { CitationService } from './citation.service';
import { SKIP_RESPONSE_WRAP } from '../../common/interceptors/response.interceptor';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { JwtPayload } from '../../common/decorators/current-user.decorator';

@Controller('chat')
export class ChatController {
  constructor(
    private readonly chat: ChatService,
    private readonly session: SessionService,
    private readonly citation: CitationService,
  ) {}

  @Post('/sessions')
  create(
    @Body() createSessionDto: CreateSessionDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.session.create(createSessionDto, user.sub);
  }

  @Get('/sessions')
  findAllSessions(@CurrentUser() user: JwtPayload) {
    return this.session.findAll(user.sub);
  }

  // GET /chat/sessions/:id/messages —— 获取会话消息（历史）
  @Get('sessions/:id/messages')
  getMessages(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.session.findMessages(id, user.sub);
  }

  // POST /chat/sessions/:id/messages —— 发送消息 (SSE 流式返回)
  // 前置只取会话锁：抛出的 429 在 SSE 头发出前走 HttpExceptionFilter → HTTP 状态码 JSON；
  // 目标解析/流内错误由 streamMessage 发 {type:'error'} 事件兜底；
  // @Sse 默认注册为 GET，必须显式覆盖成 POST（前端 fetch POST），否则与上面 GET 历史路由冲突；
  // 客户端断开时 @Sse 内部退订 Observable → teardown 里 abort 底层模型流。
  @SetMetadata(SKIP_RESPONSE_WRAP, true)
  @Sse('sessions/:id/messages', { method: RequestMethod.POST })
  async sendMessage(
    @Param('id') id: string,
    @Body() body: SendMessageDto,
    @CurrentUser() user: JwtPayload,
  ): Promise<Observable<MessageEvent>> {
    await this.chat.prepare(id);

    const abort = new AbortController();
    return new Observable<MessageEvent>((subscriber) => {
      void (async () => {
        try {
          for await (const ev of this.chat.streamMessage(
            id,
            user.sub,
            body.content,
            abort.signal,
          )) {
            subscriber.next({ data: ev });
          }
          subscriber.next({ data: '[DONE]' });
          subscriber.complete();
        } catch (e) {
          subscriber.next({
            data: { type: 'error', data: { message: (e as Error).message } },
          });
          subscriber.complete();
        }
      })();
      // 客户端断开（@Sse 内部退订）→ abort → provider 流 AbortError → streamMessage finally 释放锁
      return () => abort.abort();
    });
  }
}
