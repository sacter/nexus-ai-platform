import { Controller, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';
import { PromptTemplateService } from './prompt_template.service';
import { CreatePromptTemplateDto } from './dto/create-prompt_template.dto';
import { UpdatePromptTemplateDto } from './dto/update-prompt_template.dto';

@Controller('prompt-template')
export class PromptTemplateController {
  constructor(private readonly promptTemplateService: PromptTemplateService) {}

  @Post()
  create(@Body() createPromptTemplateDto: CreatePromptTemplateDto) {
    return this.promptTemplateService.create(createPromptTemplateDto);
  }

  @Get()
  findAll() {
    return this.promptTemplateService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.promptTemplateService.findOne(+id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updatePromptTemplateDto: UpdatePromptTemplateDto) {
    return this.promptTemplateService.update(+id, updatePromptTemplateDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.promptTemplateService.remove(+id);
  }
}
