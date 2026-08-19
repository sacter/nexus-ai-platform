import { Injectable } from '@nestjs/common';
import { CreatePromptTemplateDto } from './dto/create-prompt_template.dto';
import { UpdatePromptTemplateDto } from './dto/update-prompt_template.dto';

@Injectable()
export class PromptTemplateService {
  create(createPromptTemplateDto: CreatePromptTemplateDto) {
    return 'This action adds a new promptTemplate';
  }

  findAll() {
    return `This action returns all promptTemplate`;
  }

  findOne(id: number) {
    return `This action returns a #${id} promptTemplate`;
  }

  update(id: number, updatePromptTemplateDto: UpdatePromptTemplateDto) {
    return `This action updates a #${id} promptTemplate`;
  }

  remove(id: number) {
    return `This action removes a #${id} promptTemplate`;
  }
}
