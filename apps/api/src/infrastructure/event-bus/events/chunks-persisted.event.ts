/** 索引分块落库完成事件 */
export const CHUNKS_PERSISTED = 'index.chunks_persisted';

export interface ChunksPersistedEvent {
  documentId: string;
  versionId: string;
  kbId: string;
  chunkIds: string[];
  indexJobId: string;
}
