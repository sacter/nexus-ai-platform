import { SessionLockService } from './session-lock.service';

describe('SessionLockService', () => {
  const redisMock = {
    acquireLock: jest.fn(),
    releaseLock: jest.fn(),
  };
  let service: SessionLockService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new SessionLockService(redisMock as never);
  });

  it('acquire 使用 lock:session:{id} 前缀且默认 30s TTL', async () => {
    redisMock.acquireLock.mockResolvedValue(true);
    const ok = await service.acquire('abc123');
    expect(ok).toBe(true);
    expect(redisMock.acquireLock).toHaveBeenCalledWith('lock:session:abc123', 30000);
  });

  it('锁被持有（已有请求处理中）时返回 false', async () => {
    redisMock.acquireLock.mockResolvedValue(false);
    await expect(service.acquire('abc123')).resolves.toBe(false);
  });

  it('release 释放锁', async () => {
    await service.release('abc123');
    expect(redisMock.releaseLock).toHaveBeenCalledWith('lock:session:abc123');
  });
});
