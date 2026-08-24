import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { PromptTemplateService } from './prompt_template.service';
import { CreatePromptTemplateDto } from './dto/create-prompt_template.dto';
import { UpdatePromptTemplateDto } from './dto/update-prompt_template.dto';
import {
  CurrentUser,
  type JwtPayload,
} from '../../common/decorators/current-user.decorator';

@Controller('prompt-templates')
export class PromptTemplateController {
  constructor(private readonly promptTemplateService: PromptTemplateService) {}

  @Post()
  create(
    @Body() dto: CreatePromptTemplateDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.promptTemplateService.create(dto, user.sub);
  }

  @Get()
  findAll() {
    return this.promptTemplateService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.promptTemplateService.findOne(id);
  }

  @Get(':id/versions')
  listVersions(@Param('id') id: string) {
    return this.promptTemplateService.listVersions(id);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdatePromptTemplateDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.promptTemplateService.update(id, dto, user.sub);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.promptTemplateService.remove(id);
  }
}
