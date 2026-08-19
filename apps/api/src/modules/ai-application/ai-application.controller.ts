import { Controller, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';
import { AiApplicationService } from './ai-application.service';
import { CreateAiApplicationDto } from './dto/create-ai-application.dto';
import { UpdateAiApplicationDto } from './dto/update-ai-application.dto';

@Controller('ai-application')
export class AiApplicationController {
  constructor(private readonly aiApplicationService: AiApplicationService) {}

  @Post()
  create(@Body() createAiApplicationDto: CreateAiApplicationDto) {
    return this.aiApplicationService.create(createAiApplicationDto);
  }

  @Get()
  findAll() {
    return this.aiApplicationService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.aiApplicationService.findOne(+id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateAiApplicationDto: UpdateAiApplicationDto) {
    return this.aiApplicationService.update(+id, updateAiApplicationDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.aiApplicationService.remove(+id);
  }
}
