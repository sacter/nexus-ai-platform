export interface IndexJob {
  id: string;
  type: string;
  status: 'PENDING' | 'RUNNING' | 'DONE' | 'FAILED';
  progress: number;
  documentId: string;
  createdAt: string;
}
