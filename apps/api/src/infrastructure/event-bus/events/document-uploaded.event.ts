/** 文档上传完成事件 —— 触发 Index Worker */
export const DOCUMENT_UPLOADED = 'document.uploaded';

export interface DocumentUploadedEvent {
  documentId: string;
  versionId: string;
  kbId: string;
}
