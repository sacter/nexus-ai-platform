import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '@nexus/database';
import type { JobStatus, JobType, Prisma } from '@prisma/client';
import { ListJobsDto } from './dto/list-jobs.dto';

export interface IndexJobRow {
  id: string;
  bizId: string | null;
  documentId: string;
  documentName: string;
  kbId: string;
  kbName: string;
  versionId: string | null;
  versionNumber: number | null;
  type: JobType;
  status: JobStatus;
  progress: number;
  totalSteps: number;
  currentStep: number;
  stepDescription: string | null;
  errorMessage: string | null;
  retryCount: number;
  startedAt: Date | null;
  completedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

type JobWithRelations = Prisma.IndexJobGetPayload<{
  include: {
    document: {
      select: {
        id: true;
        name: true;
        kbId: true;
        kb: { select: { id: true; name: true } };
      };
    };
    version: { select: { id: true; versionNumber: true } };
  };
}>;

const JOB_INCLUDE = {
  document: {
    select: {
      id: true,
      name: true,
      kbId: true,
      kb: { select: { id: true, name: true } },
    },
  },
  version: { select: { id: true, versionNumber: true } },
} as const;

@Injectable()
export class JobService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: ListJobsDto) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const documentWhere: Prisma.DocumentWhereInput = {
      ...(query.kbId ? { kbId: query.kbId } : {}),
      ...(query.keyword?.trim()
        ? { name: { contains: query.keyword.trim(), mode: 'insensitive' } }
        : {}),
    };
    const where: Prisma.IndexJobWhereInput = {
      ...(query.documentId ? { documentId: query.documentId } : {}),
      ...(Object.keys(documentWhere).length ? { document: documentWhere } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.type ? { jobType: query.type } : {}),
    };

    const [total, rows] = await this.prisma.$transaction([
      this.prisma.indexJob.count({ where }),
      this.prisma.indexJob.findMany({
        where,
        include: JOB_INCLUDE,
        orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);

    return {
      items: rows.map((row) => this.toRow(row)),
      total,
      page,
      pageSize,
    };
  }

  async findOne(id: string) {
    const row = await this.prisma.indexJob.findUnique({
      where: { id },
      include: JOB_INCLUDE,
    });
    if (!row) throw new NotFoundException('任务不存在');
    return this.toRow(row);
  }

  async cancel(id: string) {
    const row = await this.prisma.indexJob.findUnique({ where: { id } });
    if (!row) throw new NotFoundException('任务不存在');
    if (!['PENDING', 'RUNNING'].includes(row.status)) {
      throw new BadRequestException('仅排队中或执行中的任务可以取消');
    }

    await this.prisma.indexJob.update({
      where: { id },
      data: {
        status: 'FAILED',
        errorMessage: '任务已手动取消',
        completedAt: new Date(),
      },
    });
    return this.findOne(id);
  }

  async retry(id: string) {
    const row = await this.prisma.indexJob.findUnique({ where: { id } });
    if (!row) throw new NotFoundException('任务不存在');
    if (row.status !== 'FAILED') {
      throw new BadRequestException('仅失败的任务可以重试');
    }
    if (!row.bizId) {
      throw new BadRequestException('该任务缺少幂等键，无法安全重试');
    }

    await this.prisma.indexJob.update({
      where: { id },
      data: {
        status: 'PENDING',
        progress: 0,
        currentStep: 0,
        stepDescription: '等待重新执行',
        errorMessage: null,
        retryCount: { increment: 1 },
        startedAt: null,
        completedAt: null,
      },
    });
    return this.findOne(id);
  }

  private toRow(row: JobWithRelations): IndexJobRow {
    return {
      id: row.id,
      bizId: row.bizId,
      documentId: row.documentId,
      documentName: row.document?.name ?? '未知文档',
      kbId: row.document?.kbId ?? '',
      kbName: row.document?.kb?.name ?? '未知知识库',
      versionId: row.versionId,
      versionNumber: row.version?.versionNumber ?? null,
      type: row.jobType,
      status: row.status,
      progress: row.progress,
      totalSteps: row.totalSteps,
      currentStep: row.currentStep,
      stepDescription: row.stepDescription,
      errorMessage: row.errorMessage,
      retryCount: row.retryCount,
      startedAt: row.startedAt,
      completedAt: row.completedAt,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }
}
