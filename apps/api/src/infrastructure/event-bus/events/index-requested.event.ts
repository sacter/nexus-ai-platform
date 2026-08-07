/** 重新索引请求事件 —— 触发 Reindex Worker */
export const INDEX_REQUESTED = 'index.requested';

export interface IndexRequestedEvent {
  documentId: string;
  versionId: string;
  kbId: string;
}
