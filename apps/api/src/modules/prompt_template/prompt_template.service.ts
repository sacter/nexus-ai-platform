import { Injectable } from '@nestjs/common';
import { CreatePromptTemplateDto } from './dto/create-prompt_template.dto';
import { UpdatePromptTemplateDto } from './dto/update-prompt_template.dto';
import { PrismaService } from '@nexus/database';

@Injectable()
export class PromptTemplateService {
  constructor(private readonly prisma: PrismaService) {}

  create(createPromptTemplateDto: CreatePromptTemplateDto) {
    return 'This action adds a new promptTemplate';
  }

  findAll() {
    return this.prisma.promptTemplate.findMany();
  }

  findOne(id: string) {
    return `This action returns a #${id} promptTemplate`;
  }

  update(id: string, updatePromptTemplateDto: UpdatePromptTemplateDto) {
    return `This action updates a #${id} promptTemplate`;
  }

  remove(id: string) {
    return `This action removes a #${id} promptTemplate`;
  }
}
