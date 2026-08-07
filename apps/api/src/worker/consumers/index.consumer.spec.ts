import { Test } from '@nestjs/testing';
import { IndexConsumer } from './index.consumer';
import { QueueService } from '../../infrastructure/queue/queue.service';
import { IndexPipeline } from '../pipelines/index-pipeline';

describe('IndexConsumer', () => {
  it('收到 document.uploaded 后入队 index Queue', async () => {
    const queueMock = { add: jest.fn().mockResolvedValue(undefined) };
    const pipelineMock = {} as never;
    const moduleRef = await Test.createTestingModule({
      providers: [
        IndexConsumer,
        { provide: QueueService, useValue: queueMock },
        { provide: IndexPipeline, useValue: pipelineMock },
      ],
    }).compile();

    const consumer = moduleRef.get(IndexConsumer);
    await consumer.handleUploaded({ documentId: 'd1', versionId: 'v1', kbId: 'kb1' });
    expect(queueMock.add).toHaveBeenCalledWith('index', 'index-document', {
      documentId: 'd1', versionId: 'v1', kbId: 'kb1',
    });
  });
});
