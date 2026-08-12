import { Global, Module } from '@nestjs/common';
import { ModelProviderService } from './model-provider.service.js';

@Global()
@Module({
  providers: [ModelProviderService],
  exports: [ModelProviderService],
})
export class ModelProviderModule {}
