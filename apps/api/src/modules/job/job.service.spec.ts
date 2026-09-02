import { BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@nexus/database';
import { JobService } from './job.service';

type PrismaMock = {
  indexJob: Record<string, jest.Mock>;
  $transaction: jest.Mock;
};

function makePrismaMock(): PrismaMock {
  const mock: PrismaMock = {
    indexJob: {
      count: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    $transaction: jest.fn(async (input: unknown) => {
      if (Array.isArray(input)) return Promise.all(input);
      if (typeof input === 'function') return input(mock);
      return input;
    }),
  };
  return mock;
}

function mockJobRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'job-1',
    bizId: 'version-1',
    documentId: 'doc-1',
    versionId: 'version-1',
    jobType: 'INDEX',
    status: 'RUNNING',
    progress: 40,
    totalSteps: 5,
    currentStep: 2,
    stepDescription: '向量化切片',
    errorMessage: null,
    retryCount: 0,
    startedAt: new Date('2026-08-01T08:00:00Z'),
    completedAt: null,
    createdAt: new Date('2026-08-01T07:59:00Z'),
    updatedAt: new Date('2026-08-01T08:05:00Z'),
    document: {
      id: 'doc-1',
      name: '系统需求说明书.pdf',
      kbId: 'kb-1',
      kb: { id: 'kb-1', name: '研发知识库' },
    },
    version: { id: 'version-1', versionNumber: 3 },
    ...overrides,
  };
}

describe('JobService', () => {
  let service: JobService;
  let prisma: PrismaMock;

  beforeEach(() => {
    prisma = makePrismaMock();
    service = new JobService(prisma as unknown as PrismaService);
  });

  it('findAll：按状态/类型/知识库筛选并返回扁平行', async () => {
    prisma.indexJob.count.mockResolvedValue(1);
    prisma.indexJob.findMany.mockResolvedValue([mockJobRow()]);

    const result = await service.findAll({
      page: 2,
      pageSize: 10,
      status: 'RUNNING',
      type: 'INDEX',
      kbId: 'kb-1',
      documentId: 'doc-1',
      keyword: '需求',
    });

    expect(result).toMatchObject({ total: 1, page: 2, pageSize: 10 });
    expect(result.items[0]).toMatchObject({
      id: 'job-1',
      type: 'INDEX',
      status: 'RUNNING',
      documentName: '系统需求说明书.pdf',
      kbName: '研发知识库',
      versionNumber: 3,
    });
    expect(prisma.indexJob.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          documentId: 'doc-1',
          status: 'RUNNING',
          jobType: 'INDEX',
          document: expect.objectContaining({
            kbId: 'kb-1',
            name: expect.objectContaining({
              contains: '需求',
              mode: 'insensitive',
            }),
          }),
        }),
        skip: 10,
        take: 10,
      }),
    );
  });

  it('findOne：任务不存在 → NotFound', async () => {
    prisma.indexJob.findUnique.mockResolvedValue(null);

    await expect(service.findOne('missing')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('cancel：仅允许 PENDING/RUNNING，并把任务标记为失败', async () => {
    prisma.indexJob.findUnique.mockResolvedValue(
      mockJobRow({ status: 'RUNNING' }),
    );
    prisma.indexJob.findUnique.mockResolvedValueOnce(
      mockJobRow({ status: 'RUNNING' }),
    );

    const result = await service.cancel('job-1');

    expect(prisma.indexJob.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'job-1' },
        data: expect.objectContaining({
          status: 'FAILED',
          errorMessage: '任务已手动取消',
        }),
      }),
    );
    expect(result.status).toBe('RUNNING');
  });

  it('cancel：已完成任务 → BadRequest', async () => {
    prisma.indexJob.findUnique.mockResolvedValue(
      mockJobRow({ status: 'DONE' }),
    );

    await expect(service.cancel('job-1')).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('retry：失败任务重置为待执行并递增重试次数', async () => {
    prisma.indexJob.findUnique.mockResolvedValue(
      mockJobRow({ status: 'FAILED' }),
    );

    const result = await service.retry('job-1');

    expect(prisma.indexJob.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'job-1' },
        data: expect.objectContaining({
          status: 'PENDING',
          progress: 0,
          currentStep: 0,
          retryCount: { increment: 1 },
        }),
      }),
    );
    expect(result.status).toBe('FAILED');
  });

  it('retry：缺少 bizId → BadRequest，避免破坏幂等语义', async () => {
    prisma.indexJob.findUnique.mockResolvedValue(
      mockJobRow({ status: 'FAILED', bizId: null }),
    );

    await expect(service.retry('job-1')).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });
});
