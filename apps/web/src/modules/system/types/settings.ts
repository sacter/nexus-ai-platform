export interface Settings {
  embeddingModel: string;
  chunkSize: number;
  chunkOverlap: number;
  retrievalStrategy: 'vector' | 'hybrid';
  rerankEnabled: boolean;
}
