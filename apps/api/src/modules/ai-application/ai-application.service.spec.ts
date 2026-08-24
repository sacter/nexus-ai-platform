import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '@nexus/database';
import { AiApplicationService } from './ai-application.service';

/** 构造带 include 的应用行（APP_INCLUDE 的完整形状） */
function mockAppRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'app-1',
    name: '财务助手',
    description: null,
    icon: 'bot',
    knowledgeBaseId: 'kb-1',
    workflowId: 'wf-1',
    modelId: 'model-1',
    promptTemplateId: null,
    status: 'draft',
    config: {},
    createdBy: 'user-1',
    createdAt: new Date('2026-08-01'),
    updatedAt: new Date('2026-08-02'),
    kb: { id: 'kb-1', name: '财务制度库' },
    workflow: { id: 'wf-1', name: 'RAG 检索', type: 'rag' },
    model: { id: 'model-1', displayName: 'DeepSeek Chat', provider: 'deepseek' },
    promptTemplate: null,
    tools: [],
    ...overrides,
  };
}

type PrismaMock = {
  [K in
    | 'aiApplication'
    | 'aiApplicationTool'
    | 'knowledgeBase'
    | 'workflow'
    | 'model'
    | 'promptTemplate'
    | 'tool']: Record<string, jest.Mock>;
} & { $transaction: jest.Mock };

function makePrismaMock(): PrismaMock {
  const mock: PrismaMock = {
    aiApplication: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    aiApplicationTool: {
      findUnique: jest.fn(),
      create: jest.fn(),
      createMany: jest.fn(),
      delete: jest.fn(),
      deleteMany: jest.fn(),
    },
    knowledgeBase: { findUnique: jest.fn() },
    workflow: { findUnique: jest.fn() },
    model: { findUnique: jest.fn() },
    promptTemplate: { findUnique: jest.fn() },
    tool: { findUnique: jest.fn(), findMany: jest.fn() },
    // 事务回调直接在同一 mock 上执行（tx = mock）
    $transaction: jest.fn(async (cb: (tx: PrismaMock) => unknown) => cb(mock)),
  };
  return mock;
}

describe('AiApplicationService', () => {
  let service: AiApplicationService;
  let prisma: PrismaMock;

  beforeEach(() => {
    prisma = makePrismaMock();
    service = new AiApplicationService(prisma as unknown as PrismaService);
  });

  afterEach(() => jest.restoreAllMocks());

  it('findAll：联查资源名并扁平化返回', async () => {
    prisma.aiApplication.findMany.mockResolvedValue([mockAppRow()]);

    const [app] = await service.findAll();

    expect(app.kbName).toBe('财务制度库');
    expect(app.workflowType).toBe('rag');
    expect(app.modelDisplayName).toBe('DeepSeek Chat');
    expect(app.promptTemplateName).toBeNull();
    expect(app.tools).toEqual([]);
    expect('kb' in app).toBe(false);
  });

  it('create：知识库不存在 → NotFound，且不写库', async () => {
    prisma.knowledgeBase.findUnique.mockResolvedValue(null);

    await expect(
      service.create(
        {
          name: 'x',
          knowledgeBaseId: 'bad-kb',
          workflowId: 'wf-1',
          modelId: 'model-1',
        },
        'user-1',
      ),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('create：默认 icon/status/config，工具随事务一次绑定，返回联查详情', async () => {
    prisma.knowledgeBase.findUnique.mockResolvedValue({ id: 'kb-1' });
    prisma.workflow.findUnique.mockResolvedValue({ id: 'wf-1' });
    prisma.model.findUnique.mockResolvedValue({ id: 'model-1' });
    prisma.tool.findMany.mockResolvedValue([{ id: 'tool-1' }]);
    prisma.aiApplication.create.mockResolvedValue({ id: 'app-1' });
    prisma.aiApplication.findUnique.mockResolvedValue(mockAppRow());

    const app = await service.create(
      {
        name: '财务助手',
        knowledgeBaseId: 'kb-1',
        workflowId: 'wf-1',
        modelId: 'model-1',
        toolIds: ['tool-1', 'tool-1'], // 去重后只剩一个
      },
      'user-1',
    );

    const createData = prisma.aiApplication.create.mock.calls[0][0].data;
    expect(createData.icon).toBe('bot');
    expect(createData.status).toBe('draft');
    expect(createData.config).toEqual({});
    expect(createData.createdBy).toBe('user-1');
    expect(prisma.aiApplicationTool.createMany).toHaveBeenCalledWith({
      data: [{ applicationId: 'app-1', toolId: 'tool-1' }],
    });
    expect(app.name).toBe('财务助手');
  });

  it('create：config.temperature 越界 → BadRequest', async () => {
    prisma.knowledgeBase.findUnique.mockResolvedValue({ id: 'kb-1' });
    prisma.workflow.findUnique.mockResolvedValue({ id: 'wf-1' });
    prisma.model.findUnique.mockResolvedValue({ id: 'model-1' });

    await expect(
      service.create(
        {
          name: 'x',
          knowledgeBaseId: 'kb-1',
          workflowId: 'wf-1',
          modelId: 'model-1',
          config: { temperature: 3 },
        },
        'user-1',
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('update：传 toolIds 时同一事务整体替换绑定', async () => {
    prisma.aiApplication.findUnique
      .mockResolvedValueOnce(mockAppRow()) // existing 检查
      .mockResolvedValueOnce(mockAppRow()); // 末尾 findOne 重读
    prisma.knowledgeBase.findUnique.mockResolvedValue({ id: 'kb-1' });
    prisma.workflow.findUnique.mockResolvedValue({ id: 'wf-1' });
    prisma.model.findUnique.mockResolvedValue({ id: 'model-1' });
    prisma.tool.findMany.mockResolvedValue([{ id: 'tool-2' }]);

    await service.update('app-1', { name: '新名字', toolIds: ['tool-2'] });

    expect(prisma.$transaction).toHaveBeenCalled();
    expect(prisma.aiApplicationTool.deleteMany).toHaveBeenCalledWith({
      where: { applicationId: 'app-1' },
    });
    expect(prisma.aiApplicationTool.createMany).toHaveBeenCalledWith({
      data: [{ applicationId: 'app-1', toolId: 'tool-2' }],
    });
    const updateData = prisma.aiApplication.update.mock.calls[0][0].data;
    expect('toolIds' in updateData).toBe(false);
  });

  it('update：应用不存在 → NotFound', async () => {
    prisma.aiApplication.findUnique.mockResolvedValue(null);

    await expect(
      service.update('ghost', { name: 'x' }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('bindTool：重复绑定 → Conflict', async () => {
    prisma.aiApplication.findUnique.mockResolvedValue({ id: 'app-1' });
    prisma.tool.findUnique.mockResolvedValue({ id: 'tool-1' });
    prisma.aiApplicationTool.findUnique.mockResolvedValue({ id: 'bind-1' });

    await expect(
      service.bindTool('app-1', { toolId: 'tool-1' }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('remove：被会话引用（P2003）→ Conflict', async () => {
    prisma.aiApplication.delete.mockRejectedValue({ code: 'P2003' });

    await expect(service.remove('app-1')).rejects.toBeInstanceOf(
      ConflictException,
    );
  });
});
