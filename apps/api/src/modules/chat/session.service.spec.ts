import { SessionService } from './session.service';
import { NotFoundException } from '@nestjs/common';
import { DEFAULT_WORKFLOW_TYPE } from '@nexus/config';
import type { PrismaService } from '@nexus/database';

describe('SessionService.create', () => {
  let prisma: any;
  let service: SessionService;

  beforeEach(() => {
    prisma = {
      aiApplication: { findUnique: jest.fn() },
      workflow: { findUnique: jest.fn() },
      chatSession: { create: jest.fn() },
      chatSessionTool: { createMany: jest.fn() },
      // 交互式事务：回调以 prisma 作为 tx，沿用上面的 create/createMany mock
      $transaction: jest.fn((cb: (tx: any) => unknown) => cb(prisma)),
    };
    service = new SessionService(prisma as PrismaService);
  });

  it('快捷模式：把 AI 应用的绑定快照到会话，并写入 chat_session_tools', async () => {
    prisma.aiApplication.findUnique.mockResolvedValue({
      knowledgeBaseId: 'kb-app',
      workflowId: 'wf-app',
      modelId: 'model-app',
      promptTemplateId: 'pt-app',
      workflow: { type: 'rewoo' },
      tools: [{ toolId: 'tool-1' }, { toolId: 'tool-2' }],
    });
    prisma.chatSession.create.mockResolvedValue({ id: 's-1', title: 'x' });
    prisma.chatSessionTool.createMany.mockResolvedValue({ count: 2 });

    await service.create(
      { title: '会话', aiApplicationId: 'app-1' },
      'user-1',
    );

    expect(prisma.chatSession.create).toHaveBeenCalledWith({
      data: {
        title: '会话',
        userId: 'user-1',
        aiApplicationId: 'app-1',
        kbId: 'kb-app',
        workflowId: 'wf-app',
        modelId: 'model-app',
        promptTemplateId: 'pt-app',
        workflowType: 'rewoo',
      },
    });
    expect(prisma.chatSessionTool.createMany).toHaveBeenCalledWith({
      data: [
        { sessionId: 's-1', toolId: 'tool-1' },
        { sessionId: 's-1', toolId: 'tool-2' },
      ],
    });
  });

  it('快捷模式：AI 应用不存在 → NotFoundException', async () => {
    prisma.aiApplication.findUnique.mockResolvedValue(null);
    await expect(
      service.create({ title: 'x', aiApplicationId: 'missing' }, 'u'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('自定义模式：透传 kb/model/prompt/workflow，toolIds 写入 chat_session_tools，workflowType 来自所选工作流', async () => {
    prisma.workflow.findUnique.mockResolvedValue({ type: 'rewoo' });
    prisma.chatSession.create.mockResolvedValue({ id: 's-2', title: 'y' });
    prisma.chatSessionTool.createMany.mockResolvedValue({ count: 1 });

    await service.create(
      {
        title: '自定义',
        kbId: 'kb-1',
        modelId: 'model-1',
        promptTemplateId: 'pt-1',
        workflowId: 'wf-1',
        toolIds: ['tool-1'],
      },
      'user-1',
    );

    // toolIds 不应被透传到 chatSession.create（非列）
    expect(prisma.chatSession.create).toHaveBeenCalledWith({
      data: {
        title: '自定义',
        userId: 'user-1',
        kbId: 'kb-1',
        modelId: 'model-1',
        promptTemplateId: 'pt-1',
        workflowId: 'wf-1',
        workflowType: 'rewoo',
      },
    });
    expect(prisma.chatSessionTool.createMany).toHaveBeenCalledWith({
      data: [{ sessionId: 's-2', toolId: 'tool-1' }],
    });
  });

  it('自定义模式：无工作流时 workflowType 回退 DEFAULT_WORKFLOW_TYPE', async () => {
    prisma.chatSession.create.mockResolvedValue({ id: 's-3', title: 'z' });
    await service.create({ title: '简单' }, 'user-1');
    expect(prisma.chatSession.create).toHaveBeenCalledWith({
      data: { title: '简单', userId: 'user-1', workflowType: DEFAULT_WORKFLOW_TYPE },
    });
  });
});
