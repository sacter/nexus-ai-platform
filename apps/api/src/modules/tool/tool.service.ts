import { Injectable } from '@nestjs/common';
import { CreateToolDto } from './dto/create-tool.dto';
import { UpdateToolDto } from './dto/update-tool.dto';
import { PrismaService } from '@nexus/database';

@Injectable()
export class ToolService {
  constructor(private readonly prisma: PrismaService) {}

  create(createToolDto: CreateToolDto) {
    return 'This action adds a new tool';
  }

  findAll() {
    return this.prisma.tool.findMany();
  }

  findOne(id: string) {
    return `This action returns a #${id} tool`;
  }

  update(id: string, updateToolDto: UpdateToolDto) {
    return `This action updates a #${id} tool`;
  }

  remove(id: string) {
    return `This action removes a #${id} tool`;
  }
}
