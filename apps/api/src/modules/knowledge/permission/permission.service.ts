import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database/prisma/prisma.service';
import { CreatePermissionDto } from './dto/create-permission.dto';
import { UpdatePermissionDto } from './dto/update-permission.dto';
import { BatchAssignPermissionDto } from './dto/batch-assign-permission.dto';

@Injectable()
export class PermissionService {
  constructor(private readonly prisma: PrismaService) {}

  findAllByKb(kbId: string) {
    return this.prisma.kbPermission.findMany({
      where: { kbId },
      include: {
        user: {
          select: { id: true, username: true, email: true },
        },
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  assign(kbId: string, dto: CreatePermissionDto) {
    return this.prisma.kbPermission.upsert({
      where: {
        kbId_userId: { kbId, userId: dto.userId },
      },
      create: { kbId, userId: dto.userId, role: dto.role },
      update: { role: dto.role },
    });
  }

  batchAssign(kbId: string, dto: BatchAssignPermissionDto) {
    return this.prisma.$transaction(
      dto.permissions.map((p) =>
        this.prisma.kbPermission.upsert({
          where: {
            kbId_userId: { kbId, userId: p.userId },
          },
          create: { kbId, userId: p.userId, role: p.role },
          update: { role: p.role },
        }),
      ),
    );
  }

  update(kbId: string, permissionId: string, dto: UpdatePermissionDto) {
    return this.prisma.kbPermission.update({
      where: { id: permissionId, kbId },
      data: { role: dto.role },
    });
  }

  remove(kbId: string, permissionId: string) {
    return this.prisma.kbPermission.delete({
      where: { id: permissionId, kbId },
    });
  }

  findMyPermission(kbId: string, userId: string) {
    return this.prisma.kbPermission.findUnique({
      where: { kbId_userId: { kbId, userId } },
    });
  }
}
