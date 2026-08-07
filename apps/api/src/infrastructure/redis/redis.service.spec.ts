import { Test } from '@nestjs/testing';
import { RedisService } from './redis.service';

describe('RedisService', () => {
  let service: RedisService;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [RedisService],
    }).compile();
    service = moduleRef.get(RedisService);
    // 用 mock 客户端替换，避免真实连接
    const mock = {
      get: jest.fn(),
      set: jest.fn(),
      del: jest.fn(),
      connect: jest.fn(),
      quit: jest.fn(),
      status: 'ready',
    };
    (service as unknown as { client: unknown }).client = mock;
  });

  it('get 透传 Redis get', async () => {
    (service.getClient() as unknown as { get: jest.Mock }).get.mockResolvedValue('v1');
    await expect(service.get('k')).resolves.toBe('v1');
  });

  it('set 使用 EX 写入 TTL', async () => {
    const mock = service.getClient() as unknown as { set: jest.Mock };
    mock.set.mockResolvedValue('OK');
    await service.set('k', 'v', 3600);
    expect(mock.set).toHaveBeenCalledWith('k', 'v', 'EX', 3600);
  });

  it('acquireLock 通过 SET NX PX 加锁', async () => {
    const mock = service.getClient() as unknown as { set: jest.Mock };
    mock.set.mockResolvedValue('OK');
    await expect(service.acquireLock('lock:session:abc', 30000)).resolves.toBe(true);
    expect(mock.set).toHaveBeenCalledWith('lock:session:abc', '1', 'EX', 30, 'NX');
  });

  it('acquireLock 返回 null 时代表锁已被持有', async () => {
    const mock = service.getClient() as unknown as { set: jest.Mock };
    mock.set.mockResolvedValue(null);
    await expect(service.acquireLock('lock:session:abc', 30000)).resolves.toBe(false);
  });

  it('releaseLock 删除锁 key', async () => {
    const mock = service.getClient() as unknown as { del: jest.Mock };
    mock.del.mockResolvedValue(1);
    await service.releaseLock('lock:session:abc');
    expect(mock.del).toHaveBeenCalledWith('lock:session:abc');
  });
});
