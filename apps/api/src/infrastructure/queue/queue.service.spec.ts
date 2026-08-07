import { QueueService } from './queue.service';

jest.mock('bullmq', () => {
  return {
    Queue: jest.fn().mockImplementation((name: string, opts: unknown) => ({ name, opts })),
  };
});

describe('QueueService', () => {
  let service: QueueService;

  beforeEach(() => {
    service = new QueueService();
  });

  it('getQueue 返回同名 BullMQ Queue（懒创建）', () => {
    const q1 = service.getQueue('embedding');
    const q2 = service.getQueue('embedding');
    expect(q1).toBe(q2);
    expect((q1 as { name: string }).name).toBe('embedding');
  });

  it('队列配置含并发数', () => {
    const q = service.getQueue('index') as { opts: { defaultJobOptions: unknown } };
    expect(q.opts).toBeDefined();
  });
});
