import { Injectable } from '@nestjs/common';
import { PrismaService } from '@nexus/database';
import { CreateAiApplicationDto } from './dto/create-ai-application.dto';
import { UpdateAiApplicationDto } from './dto/update-ai-application.dto';

@Injectable()
export class AiApplicationService {
  constructor(private readonly prisma: PrismaService) {}

  create(createAiApplicationDto: CreateAiApplicationDto) {
    return 'This action adds a new aiApplication';
  }

  findAll() {
    return this.prisma.aiApplication.findMany();
  }

  findOne(id: string) {
    return this.prisma.aiApplication.findUnique({ where: { id } });
  }

  update(id: string, updateAiApplicationDto: UpdateAiApplicationDto) {
    return `This action updates a #${id} aiApplication`;
  }

  remove(id: string) {
    return `This action removes a #${id} aiApplication`;
  }
}
