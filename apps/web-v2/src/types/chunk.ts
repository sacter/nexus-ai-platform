export interface Chunk {
  id: string;
  content: string;
  metadata: Record<string, unknown>;
  documentId: string;
  versionId: string;
}
