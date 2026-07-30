import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database/prisma/prisma.service';
import { CreateKnowledgeBaseDto } from './dto/create-knowledge-base.dto';
import { UpdateKnowledgeBaseDto } from './dto/update-knowledge-base.dto';

@Injectable()
export class KnowledgeBaseService {
  constructor(private readonly prisma: PrismaService) {}

  create(createKnowledgeBaseDto: CreateKnowledgeBaseDto) {
    return 'This action adds a new knowledgeBase';
  }

  findAll() {
    return this.prisma.knowledgeBase.findMany();
  }

  findOne(id: number) {
    return `This action returns a #${id} knowledgeBase`;
  }

  update(id: number, updateKnowledgeBaseDto: UpdateKnowledgeBaseDto) {
    return `This action updates a #${id} knowledgeBase`;
  }

  remove(id: number) {
    return `This action removes a #${id} knowledgeBase`;
  }
}
