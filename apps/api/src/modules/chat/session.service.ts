import { Injectable } from '@nestjs/common';
import { PrismaService } from '@nexus/database';
import { CreateSessionDto } from './dto/create-session.dto';

@Injectable()
export class SessionService {
  constructor(private prisma: PrismaService) {}

  findAll() {
    return this.prisma.chatSession.findMany({ orderBy: { createdAt: 'desc' } });
  }
}
