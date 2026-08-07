/** 文档软删除事件 —— 触发 Delete-Chunks + GC Worker */
export const DOCUMENT_DELETED = 'document.deleted';

export interface DocumentDeletedEvent {
  documentId: string;
  kbId: string;
}
