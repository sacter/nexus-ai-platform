export interface Document {
  id: string;
  name: string;
  status: 'UPLOADING' | 'PROCESSING' | 'READY' | 'DELETED';
  version: number;
  chunkCount: number;
  createdAt: string;
  updatedAt: string;
}
