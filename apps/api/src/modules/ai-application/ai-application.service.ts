import { Injectable } from '@nestjs/common';
import { CreateAiApplicationDto } from './dto/create-ai-application.dto';
import { UpdateAiApplicationDto } from './dto/update-ai-application.dto';

@Injectable()
export class AiApplicationService {
  create(createAiApplicationDto: CreateAiApplicationDto) {
    return 'This action adds a new aiApplication';
  }

  findAll() {
    return `This action returns all aiApplication`;
  }

  findOne(id: number) {
    return `This action returns a #${id} aiApplication`;
  }

  update(id: number, updateAiApplicationDto: UpdateAiApplicationDto) {
    return `This action updates a #${id} aiApplication`;
  }

  remove(id: number) {
    return `This action removes a #${id} aiApplication`;
  }
}
