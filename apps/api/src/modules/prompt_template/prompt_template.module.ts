import { Module } from '@nestjs/common';
import { PromptTemplateService } from './prompt_template.service';
import { PromptTemplateController } from './prompt_template.controller';

@Module({
  controllers: [PromptTemplateController],
  providers: [PromptTemplateService],
})
export class PromptTemplateModule {}
