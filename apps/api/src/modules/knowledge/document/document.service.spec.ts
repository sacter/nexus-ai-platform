import { NotFoundException, ConflictException } from '@nestjs/common';
import { DocumentService } from './document.service';
import { DOCUMENT_UPLOADED } from '../../../infrastructure/event-bus/events/document-uploaded.event';
import { DOCUMENT_DELETED } from '../../../infrastructure/event-bus/events/document-deleted.event';
import { INDEX_REQUESTED } from '../../../infrastructure/event-bus/events/index-requested.event';

describe('DocumentService 事件接线', () => {
  function setup() {
    const txMock = {
      documentVersion: { findFirst: jest.fn(), create: jest.fn() },
      document: { findFirst: jest.fn(), create: jest.fn(), update: jest.fn() },
    };
    const prismaMock = {
      $transaction: jest.fn(async (cb: (tx: unknown) => unknown) => cb(txMock)),
      document: { findFirst: jest.fn(), update: jest.fn() },
    };
    const minioMock = {
      deleteObjects: jest.fn(),
      generatePresignedDownloadUrl: jest.fn(),
    };
    const eventBusMock = { emit: jest.fn().mockResolvedValue(true) };

    const service = new DocumentService(
      prismaMock as never,
      minioMock as never,
      eventBusMock as never,
    );

    return { txMock, prismaMock, minioMock, eventBusMock, service };
  }

  it('saveMeta 事务成功后发布 document.uploaded', async () => {
    const { txMock, eventBusMock, service } = setup();

    txMock.document.findFirst.mockResolvedValue(null);
    txMock.document.create.mockResolvedValue({ id: 'doc1' });
    txMock.documentVersion.create.mockResolvedValue({ id: 'ver1' });
    txMock.document.update.mockResolvedValue({});

    const result = await service.saveMeta('kb1', 'u1', {
      name: '手册',
      originalName: '手册.pdf',
      url: 'kb/kb1/x.pdf',
      fileSize: 100,
      mimeType: 'application/pdf',
    });

    expect(result.isNew).toBe(true);
    expect(eventBusMock.emit).toHaveBeenCalledWith(DOCUMENT_UPLOADED, {
      documentId: 'doc1',
      versionId: 'ver1',
      kbId: 'kb1',
    });
  });

  it('softDelete 置 DELETED 后发布 document.deleted', async () => {
    const { prismaMock, eventBusMock, service } = setup();

    prismaMock.document.findFirst.mockResolvedValue({
      id: 'doc1',
      kbId: 'kb1',
      status: 'READY',
    });
    prismaMock.document.update.mockResolvedValue({
      id: 'doc1',
      status: 'DELETED',
    });

    const updated = await service.softDelete('kb1', 'doc1');

    expect(updated.status).toBe('DELETED');
    expect(eventBusMock.emit).toHaveBeenCalledWith(DOCUMENT_DELETED, {
      documentId: 'doc1',
      kbId: 'kb1',
    });
  });

  it('requestReindex 发布 index.requested', async () => {
    const { prismaMock, eventBusMock, service } = setup();

    prismaMock.document.findFirst.mockResolvedValue({
      id: 'doc1',
      kbId: 'kb1',
      currentVersionId: 'ver1',
      status: 'READY',
    });

    const res = await service.requestReindex('kb1', 'doc1');

    expect(res).toEqual({ reindexed: true, versionId: 'ver1' });
    expect(eventBusMock.emit).toHaveBeenCalledWith(INDEX_REQUESTED, {
      documentId: 'doc1',
      versionId: 'ver1',
      kbId: 'kb1',
    });
  });

  it('requestReindex 文档不存在/已删除 → NotFoundException', async () => {
    const { prismaMock, service } = setup();
    prismaMock.document.findFirst.mockResolvedValue(null);
    await expect(service.requestReindex('kb1', 'doc1')).rejects.toThrow(
      NotFoundException,
    );
  });

  it('requestReindex 无活跃版本 → ConflictException', async () => {
    const { prismaMock, service } = setup();
    prismaMock.document.findFirst.mockResolvedValue({
      id: 'doc1',
      kbId: 'kb1',
      currentVersionId: null,
      status: 'READY',
    });
    await expect(service.requestReindex('kb1', 'doc1')).rejects.toThrow(
      ConflictException,
    );
  });
});
