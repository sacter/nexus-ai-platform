import { ConflictException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@nexus/database';
import { PromptTemplateService } from './prompt_template.service';

function mockTemplate(overrides: Record<string, unknown> = {}) {
  return {
    id: 'pt-1',
    name: 'RAG 默认',
    description: null,
    currentVersionId: 'v-2',
    createdAt: new Date('2026-08-01'),
    updatedAt: new Date('2026-08-02'),
    _count: { versions: 2 },
    ...overrides,
  };
}

function mockVersion(overrides: Record<string, unknown> = {}) {
  return {
    id: 'v-2',
    templateId: 'pt-1',
    versionNumber: 2,
    content: 'Context: {{ context }}\nQuestion: {{question}}',
    variables: ['context', 'question'],
    isActive: true,
    createdBy: 'user-1',
    createdAt: new Date('2026-08-02'),
    ...overrides,
  };
}

type PrismaMock = {
  promptTemplate: Record<string, jest.Mock>;
  promptTemplateVersion: Record<string, jest.Mock>;
  $transaction: jest.Mock;
};

function makePrismaMock(): PrismaMock {
  const mock: PrismaMock = {
    promptTemplate: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    promptTemplateVersion: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
    },
    // 事务回调直接在同一 mock 上执行（tx = mock）
    $transaction: jest.fn(async (cb: (tx: PrismaMock) => unknown) => cb(mock)),
  };
  return mock;
}

describe('PromptTemplateService', () => {
  let service: PromptTemplateService;
  let prisma: PrismaMock;

  beforeEach(() => {
    prisma = makePrismaMock();
    service = new PromptTemplateService(prisma as unknown as PrismaService);
  });

  it('findAll：拍平当前版本内容与变量，附版本数', async () => {
    prisma.promptTemplate.findMany.mockResolvedValue([mockTemplate()]);
    prisma.promptTemplateVersion.findMany.mockResolvedValue([mockVersion()]);

    const rows = await service.findAll();

    expect(prisma.promptTemplateVersion.findMany).toHaveBeenCalledWith({
      where: { id: { in: ['v-2'] } },
    });
    expect(rows[0]).toMatchObject({
      id: 'pt-1',
      content: mockVersion().content,
      variables: ['context', 'question'],
      currentVersionNumber: 2,
      versionCount: 2,
    });
  });

  it('create：事务内建模板 → v1 → 回填 currentVersionId，变量自动抽取去重', async () => {
    prisma.promptTemplate.create.mockResolvedValue({ id: 'pt-1' });
    prisma.promptTemplateVersion.create.mockResolvedValue({ id: 'v-1' });
    prisma.promptTemplate.update.mockResolvedValue({ id: 'pt-1' });
    // create 末尾走 findOne
    prisma.promptTemplate.findUnique.mockResolvedValue(
      mockTemplate({ currentVersionId: 'v-1', _count: { versions: 1 } }),
    );
    prisma.promptTemplateVersion.findUnique.mockResolvedValue(
      mockVersion({ id: 'v-1', versionNumber: 1 }),
    );

    await service.create(
      {
        name: 'RAG 默认',
        content: 'Ctx: {{ context }} Q: {{question}} 重复 {{context}}',
      },
      'user-1',
    );

    expect(prisma.promptTemplateVersion.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        templateId: 'pt-1',
        versionNumber: 1,
        variables: ['context', 'question'],
        isActive: true,
        createdBy: 'user-1',
      }),
    });
    expect(prisma.promptTemplate.update).toHaveBeenCalledWith({
      where: { id: 'pt-1' },
      data: { currentVersionId: 'v-1' },
    });
  });

  it('create：名称重复 P2002 → 409 Conflict', async () => {
    prisma.$transaction.mockRejectedValueOnce({ code: 'P2002' });

    await expect(
      service.create({ name: 'RAG 默认', content: 'x' }, 'user-1'),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('update：仅改元信息（无 content）→ 不创建新版本', async () => {
    prisma.promptTemplate.findUnique.mockResolvedValue(mockTemplate());
    prisma.promptTemplateVersion.findFirst.mockResolvedValue({
      versionNumber: 2,
      content: 'old',
    });
    prisma.promptTemplate.update.mockResolvedValue({});
    prisma.promptTemplateVersion.findUnique.mockResolvedValue(mockVersion());

    await service.update('pt-1', { name: '新名字' }, 'user-1');

    expect(prisma.promptTemplate.update).toHaveBeenCalledWith({
      where: { id: 'pt-1' },
      data: { name: '新名字' },
    });
    expect(prisma.promptTemplateVersion.create).not.toHaveBeenCalled();
  });

  it('update：正文变更 → 事务创建 v(n+1) 且指针指向新版本（变即打版本）', async () => {
    prisma.promptTemplate.findUnique.mockResolvedValue(
      mockTemplate({ currentVersionId: 'v-3' }),
    );
    prisma.promptTemplateVersion.findFirst.mockResolvedValue({
      versionNumber: 2,
      content: 'old content',
    });
    prisma.promptTemplateVersion.create.mockResolvedValue({ id: 'v-3' });
    prisma.promptTemplate.update.mockResolvedValue({});
    prisma.promptTemplateVersion.findUnique.mockResolvedValue(
      mockVersion({ id: 'v-3', versionNumber: 3 }),
    );

    const row = await service.update(
      'pt-1',
      { content: 'new content {{context}}' },
      'user-1',
    );

    expect(prisma.promptTemplateVersion.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        templateId: 'pt-1',
        versionNumber: 3,
        content: 'new content {{context}}',
        variables: ['context'],
        isActive: true,
      }),
    });
    expect(prisma.promptTemplate.update).toHaveBeenCalledWith({
      where: { id: 'pt-1' },
      data: { currentVersionId: 'v-3' },
    });
    expect(row.currentVersionNumber).toBe(3);
  });

  it('update：正文与当前版本一致 → 不创建新版本（幂等保存）', async () => {
    prisma.promptTemplate.findUnique.mockResolvedValue(mockTemplate());
    prisma.promptTemplateVersion.findFirst.mockResolvedValue({
      versionNumber: 2,
      content: 'same',
    });
    prisma.promptTemplate.update.mockResolvedValue({});
    prisma.promptTemplateVersion.findUnique.mockResolvedValue(mockVersion());

    await service.update('pt-1', { content: 'same' }, 'user-1');

    expect(prisma.promptTemplateVersion.create).not.toHaveBeenCalled();
  });

  it('update/remove：模板不存在 → 404', async () => {
    prisma.promptTemplate.findUnique.mockResolvedValue(null);
    await expect(
      service.update('nope', { name: 'x' }, 'user-1'),
    ).rejects.toBeInstanceOf(NotFoundException);

    prisma.promptTemplate.delete.mockRejectedValue({ code: 'P2025' });
    await expect(service.remove('nope')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('listVersions：按版本号倒序，附创建者用户名，variables 归一为 string[]', async () => {
    prisma.promptTemplate.findUnique.mockResolvedValue({ id: 'pt-1' });
    prisma.promptTemplateVersion.findMany.mockResolvedValue([
      mockVersion({ createdByUser: { username: 'alice' } }),
      mockVersion({
        id: 'v-1',
        versionNumber: 1,
        variables: 'bad-json',
        createdByUser: null,
      }),
    ]);

    const versions = await service.listVersions('pt-1');

    expect(prisma.promptTemplateVersion.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ orderBy: { versionNumber: 'desc' } }),
    );
    expect(versions[0]).toMatchObject({
      versionNumber: 2,
      createdByName: 'alice',
      variables: ['context', 'question'],
    });
    expect(versions[0]).not.toHaveProperty('createdByUser');
    expect(versions[1].variables).toEqual([]);
    expect(versions[1].createdByName).toBeNull();
  });
});
