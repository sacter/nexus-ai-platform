import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
} from '@nestjs/common';
import { AiApplicationService } from './ai-application.service';
import { CreateAiApplicationDto } from './dto/create-ai-application.dto';
import { UpdateAiApplicationDto } from './dto/update-ai-application.dto';
import { BindToolDto } from './dto/bind-tool.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { JwtPayload } from '../../common/decorators/current-user.decorator';

@Controller('ai-application')
export class AiApplicationController {
  constructor(private readonly aiApplicationService: AiApplicationService) {}

  @Post()
  create(
    @Body() createAiApplicationDto: CreateAiApplicationDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.aiApplicationService.create(createAiApplicationDto, user.sub);
  }

  @Get()
  findAll() {
    return this.aiApplicationService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.aiApplicationService.findOne(id);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() updateAiApplicationDto: UpdateAiApplicationDto,
  ) {
    return this.aiApplicationService.update(id, updateAiApplicationDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.aiApplicationService.remove(id);
  }

  @Post(':id/tools')
  bindTool(@Param('id') id: string, @Body() bindToolDto: BindToolDto) {
    return this.aiApplicationService.bindTool(id, bindToolDto);
  }

  @Delete(':id/tools/:toolId')
  unbindTool(@Param('id') id: string, @Param('toolId') toolId: string) {
    return this.aiApplicationService.unbindTool(id, toolId);
  }
}
