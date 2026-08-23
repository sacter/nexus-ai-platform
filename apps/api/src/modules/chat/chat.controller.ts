import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
} from '@nestjs/common';
import { ChatService } from './chat.service';
// import { CreateChatDto } from './dto/create-chat.dto';
import { CreateSessionDto } from './dto/create-session.dto';
import { UpdateChatDto } from './dto/update-chat.dto';
import { SessionService } from './session.service';
import { CitationService } from './citation.service';
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
  @Post('sessions/:id/messages')
  sendMessage(
    @Param('id') id: string,
    @Body() body: { content: string },
    @CurrentUser() user: JwtPayload,
  ) {
    return this.chat.sendMessage(id, body, user.sub);
  }

  @Get()
  findAll() {
    return this.chat.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.chat.findOne(+id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateChatDto: UpdateChatDto) {
    return this.chat.update(+id, updateChatDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.chat.remove(+id);
  }
}
