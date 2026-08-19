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
import { CreateChatDto } from './dto/create-chat.dto';
import { UpdateChatDto } from './dto/update-chat.dto';
import { SessionService } from './session.service';
import { CitationService } from './citation.service';

@Controller('chat')
export class ChatController {
  constructor(
    private readonly chat: ChatService,
    private readonly session: SessionService,
    private readonly citation: CitationService,
  ) {}

  @Post()
  create(@Body() createChatDto: CreateChatDto) {
    return this.chat.create(createChatDto);
  }

  @Get()
  findAll() {
    return this.chat.findAll();
  }

  @Get('/sessions')
  findAllSessions() {
    return this.session.findAll();
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
