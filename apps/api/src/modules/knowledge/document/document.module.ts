import { Module } from '@nestjs/common';
import { EventBusModule } from '../../../infrastructure/event-bus/event-bus.module';
import { DocumentService } from './document.service';
import { DocumentController } from './document.controller';

@Module({
  imports: [EventBusModule],
  controllers: [DocumentController],
  providers: [DocumentService],
  exports: [DocumentService],
})
export class DocumentModule {}
