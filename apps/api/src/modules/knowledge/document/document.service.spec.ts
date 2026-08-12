import { Test } from '@nestjs/testing';
import { DocumentService } from './document.service';
import { PrismaService } from '@nexus/database';
import { MinioService } from '@nexus/shared';
import { EventBusService } from '../../../infrastructure/event-bus/event-bus.service';

describe('DocumentService.findByKbId', () => {
  let service: DocumentService;
  const prisma = {
    document: { findMany: jest.fn(), count: jest.fn() },
    $transaction: async (ops: Promise<unknown>[]) => {
      const results: unknown[] = [];
      for (const op of ops) results.push(await op);
      return results;
    },
  };

  const docRow = {
    id: 'doc1',
    kbId: 'kb1',
    name: '测试.pdf',
    status: 'READY',
    currentVersion: { id: 'v1', versionNumber: 1, status: 'READY' },
    user: { id: 'u1', username: 'alice' },
    createdAt: new Date('2026-08-08T00:00:00Z'),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const moduleRef = await Test.createTestingModule({
      providers: [
        DocumentService,
        { provide: PrismaService, useValue: prisma },
        { provide: MinioService, useValue: {} },
        { provide: EventBusService, useValue: { emit: jest.fn() } },
      ],
    }).compile();
    service = moduleRef.get(DocumentService);
  });

  it('未提供分页参数 → 返回全量数组且不调用 count', async () => {
    prisma.document.findMany.mockResolvedValue([docRow]);
    const result = await service.findByKbId('kb1');
    expect(result).toEqual([docRow]);
    expect(prisma.document.count).not.toHaveBeenCalled();
  });

  it('提供分页参数 → count + findMany(skip/take) 并返回 envelope', async () => {
    prisma.document.count.mockResolvedValue(3);
    prisma.document.findMany.mockResolvedValue([docRow]);
    const result = await service.findByKbId('kb1', { page: 2, pageSize: 20 });
    expect(prisma.document.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 20, take: 20 }),
    );
    expect(result).toEqual({
      items: [docRow],
      total: 3,
      page: 2,
      pageSize: 20,
    });
  });

  it('仅提供 page 不提供 pageSize → 返回全量数组', async () => {
    prisma.document.findMany.mockResolvedValue([docRow]);
    const result = await service.findByKbId('kb1', { page: 1 });
    expect(result).toEqual([docRow]);
    expect(prisma.document.count).not.toHaveBeenCalled();
  });

  it('非法分页值归一化：page<1 → 1，pageSize>100 → 100', async () => {
    prisma.document.count.mockResolvedValue(0);
    prisma.document.findMany.mockResolvedValue([]);
    const result = await service.findByKbId('kb1', { page: 0, pageSize: 999 });
    expect(prisma.document.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 0, take: 100 }),
    );
    expect(result).toEqual({ items: [], total: 0, page: 1, pageSize: 100 });
  });

  it('pageSize 下界归一化：pageSize<1 → 1', async () => {
    prisma.document.count.mockResolvedValue(0);
    prisma.document.findMany.mockResolvedValue([]);
    const result = await service.findByKbId('kb1', { page: 1, pageSize: 0 });
    expect(prisma.document.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 0, take: 1 }),
    );
    expect(result).toEqual({ items: [], total: 0, page: 1, pageSize: 1 });
  });

  it('传 keyword → where 含 name 模糊过滤（contains + insensitive）', async () => {
    prisma.document.count.mockResolvedValue(0);
    prisma.document.findMany.mockResolvedValue([]);
    await service.findByKbId('kb1', {
      page: 1,
      pageSize: 20,
      keyword: '系统需求',
    });
    expect(prisma.document.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          kbId: 'kb1',
          name: { contains: '系统需求', mode: 'insensitive' },
        }),
      }),
    );
  });

  it('空白 keyword → where 不含 name 过滤条件', async () => {
    prisma.document.count.mockResolvedValue(0);
    prisma.document.findMany.mockResolvedValue([]);
    await service.findByKbId('kb1', {
      page: 1,
      pageSize: 20,
      keyword: '   ',
    });
    const findManyArg = prisma.document.findMany.mock.calls[0][0];
    expect(findManyArg.where).not.toHaveProperty('name');
  });
});
