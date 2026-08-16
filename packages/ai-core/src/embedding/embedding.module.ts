import { Global, Module } from '@nestjs/common';
import { EmbeddingService } from './embedding.service.js';
import { EmbeddingConfigService } from './config.service.js';

@Global()
@Module({
  providers: [EmbeddingService, EmbeddingConfigService],
  exports: [EmbeddingService, EmbeddingConfigService],
})
export class EmbeddingModule {}
