import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
} from '@nestjs/common';
import { ChunkService } from './chunk.service';
import { CreateChunkDto } from './dto/create-chunk.dto';
import { UpdateChunkDto } from './dto/update-chunk.dto';

@Controller('chunk')
export class ChunkController {
  constructor(private readonly chunkService: ChunkService) {}

  @Post()
  create(@Body() createChunkDto: CreateChunkDto) {
    return this.chunkService.create(createChunkDto);
  }

  @Get()
  findAll() {
    return this.chunkService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.chunkService.findOne(+id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateChunkDto: UpdateChunkDto) {
    return this.chunkService.update(+id, updateChunkDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.chunkService.remove(+id);
  }
}
