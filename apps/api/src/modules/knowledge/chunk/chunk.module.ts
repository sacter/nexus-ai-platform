import { Module } from '@nestjs/common';
import { ChunkService } from './chunk.service';
import { ChunkController } from './chunk.controller';

@Module({
  controllers: [ChunkController],
  providers: [ChunkService],
})
export class ChunkModule {}
