import { Module } from '@nestjs/common';
import { AiApplicationService } from './ai-application.service';
import { AiApplicationController } from './ai-application.controller';

@Module({
  controllers: [AiApplicationController],
  providers: [AiApplicationService],
})
export class AiApplicationModule {}
