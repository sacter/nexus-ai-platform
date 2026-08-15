import { Injectable } from '@nestjs/common';
import { PrismaService } from '@nexus/database';
import { CreateModelDto } from './dto/create-model.dto';
import { UpdateModelDto } from './dto/update-model.dto';

@Injectable()
export class ModelService {
  constructor(private readonly prisma: PrismaService) {}

  create(createModelDto: CreateModelDto, userId: string) {
    return this.prisma.model.create({
      data: { ...createModelDto, createdBy: userId },
    });
  }

  findAll() {
    return this.prisma.model.findMany();
  }

  findOne(id: string) {
    return this.prisma.model.findUnique({ where: { id } });
  }

  update(id: string, updateModelDto: UpdateModelDto) {
    return this.prisma.model.update({ where: { id }, data: updateModelDto });
  }

  remove(id: string) {
    return this.prisma.model.delete({ where: { id } });
  }
}
