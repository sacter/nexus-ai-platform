import { Module } from '@nestjs/common';
import { ApiKeyService } from './api-key.service';
import { PublicKeyService } from '../auth/public-key.service';
import { ApiKeyController } from './api-key.controller';

@Module({
  controllers: [ApiKeyController],
  providers: [ApiKeyService, PublicKeyService],
  exports: [ApiKeyService],
})
export class ApiKeyModule {}
