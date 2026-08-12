import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { EventBusModule } from '../../../infrastructure/event-bus/event-bus.module';
import { QUEUE_NAMES } from '../../../infrastructure/queue/queue.constants';
import { DocumentService } from './document.service';
import { DocumentController } from './document.controller';

@Module({
  imports: [
    EventBusModule,
    BullModule.registerQueue(
      { name: QUEUE_NAMES.INDEX },
      { name: QUEUE_NAMES.DELETE_CHUNKS },
      { name: QUEUE_NAMES.CLEANUP },
      { name: QUEUE_NAMES.REINDEX },
    ),
  ],
  controllers: [DocumentController],
  providers: [DocumentService],
  exports: [DocumentService],
})
export class DocumentModule {}
