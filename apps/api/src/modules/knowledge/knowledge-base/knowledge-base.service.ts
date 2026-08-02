import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database/prisma/prisma.service';
import { CreateKnowledgeBaseDto } from './dto/create-knowledge-base.dto';
import { UpdateKnowledgeBaseDto } from './dto/update-knowledge-base.dto';

@Injectable()
export class KnowledgeBaseService {
  constructor(private readonly prisma: PrismaService) {}

  create(createKnowledgeBaseDto: CreateKnowledgeBaseDto, userId: string) {
    return this.prisma.$transaction(async (tx) => {
      const kb = await tx.knowledgeBase.create({
        data: {
          ...createKnowledgeBaseDto,
          createdBy: userId,
        },
      });
      await tx.kbPermission.create({
        data: { kbId: kb.id, userId, role: 'admin' },
      });
      return kb;
    });
  }

  findAll() {
    return this.prisma.knowledgeBase.findMany({
      include: {
        createdByUser: {
          select: { username: true },
        },
      },
    });
  }

  findOne(id: string) {
    return this.prisma.knowledgeBase.findUnique({
      where: { id },
      include: {
        createdByUser: {
          select: { username: true },
        },
      },
    });
  }

  update(id: string, updateKnowledgeBaseDto: UpdateKnowledgeBaseDto) {
    return this.prisma.knowledgeBase.update({
      where: { id },
      data: updateKnowledgeBaseDto,
    });
  }

  remove(id: string) {
    return this.prisma.knowledgeBase.delete({
      where: { id },
    });
  }
}
