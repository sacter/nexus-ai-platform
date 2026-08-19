import { PartialType } from '@nestjs/mapped-types';
import { CreateAiApplicationDto } from './create-ai-application.dto';

export class UpdateAiApplicationDto extends PartialType(CreateAiApplicationDto) {}
