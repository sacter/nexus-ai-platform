import { Injectable } from '@nestjs/common';
import { CreateChunkDto } from './dto/create-chunk.dto';
import { UpdateChunkDto } from './dto/update-chunk.dto';

@Injectable()
export class ChunkService {
  create(createChunkDto: CreateChunkDto) {
    return 'This action adds a new chunk';
  }

  findAll() {
    return `This action returns all chunk`;
  }

  findOne(id: number) {
    return `This action returns a #${id} chunk`;
  }

  update(id: number, updateChunkDto: UpdateChunkDto) {
    return `This action updates a #${id} chunk`;
  }

  remove(id: number) {
    return `This action removes a #${id} chunk`;
  }
}
