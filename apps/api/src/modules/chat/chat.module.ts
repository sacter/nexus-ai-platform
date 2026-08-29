import { Module } from '@nestjs/common';
import { ChatService } from './chat.service';
import { SessionService } from './session.service';
import { CitationService } from './citation.service';
import { ChatController } from './chat.controller';
import { RetrievalModule } from '../retrieval/retrieval.module';
import { ModelModule } from '../model/model.module';
import { SessionLockService } from '../../common/services/session-lock.service';

@Module({
  imports: [RetrievalModule, ModelModule],
  controllers: [ChatController],
  providers: [ChatService, SessionService, SessionLockService, CitationService],
})
export class ChatModule {}
