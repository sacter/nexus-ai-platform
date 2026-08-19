import { PartialType } from '@nestjs/mapped-types';
import { CreatePromptTemplateDto } from './create-prompt_template.dto';

export class UpdatePromptTemplateDto extends PartialType(CreatePromptTemplateDto) {}
