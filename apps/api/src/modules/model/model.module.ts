import { Module } from '@nestjs/common';
import { ModelService } from './model.service';
import { ModelCallerService } from './model-caller.service';
import { ModelController } from './model.controller';
import { ApiKeyModule } from '../api-key/api-key.module';

@Module({
  imports: [ApiKeyModule],
  controllers: [ModelController],
  providers: [ModelService, ModelCallerService],
  exports: [ModelService, ModelCallerService],
})
export class ModelModule {}
