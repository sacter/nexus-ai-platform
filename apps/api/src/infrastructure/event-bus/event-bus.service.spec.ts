import { EventBusService } from './event-bus.service';

describe('EventBusService', () => {
  it('emit 透传 EventEmitter2 的 emitAsync 并返回布尔结果', async () => {
    const emitter = { emitAsync: jest.fn().mockResolvedValue([true]) };
    const service = new EventBusService(emitter as never);
    await service.emit('document.uploaded', { documentId: 'd1' });
    expect(emitter.emitAsync).toHaveBeenCalledWith('document.uploaded', { documentId: 'd1' });
  });

  it('emit 聚合结果：任一 listener 返回 false 则返回 false', async () => {
    const emitter = { emitAsync: jest.fn().mockResolvedValue([true, false]) };
    const service = new EventBusService(emitter as never);
    await expect(service.emit('e', {})).resolves.toBe(false);
  });

  it('emit 聚合结果：全部 listener 非 false 则返回 true', async () => {
    const emitter = { emitAsync: jest.fn().mockResolvedValue([true, true]) };
    const service = new EventBusService(emitter as never);
    await expect(service.emit('e', {})).resolves.toBe(true);
  });

  it('emitSync 透传 EventEmitter2 的 emit', () => {
    const emitter = { emit: jest.fn().mockReturnValue(true) };
    const service = new EventBusService(emitter as never);
    service.emitSync('document.deleted', { documentId: 'd2', kbId: 'k' });
    expect(emitter.emit).toHaveBeenCalledWith('document.deleted', { documentId: 'd2', kbId: 'k' });
  });
});
