export interface KnowledgeBase {
  id: string;
  name: string;
  description?: string;
  createdBy: string;
  createdByUser?: { username: string };
  embeddingModel: string;
  retrievalStrategy: 'vector' | 'hybrid';
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export const EMBEDDING_MODEL_OPTIONS = [
  { label: 'bge-m3', value: 'bge-m3' },
  { label: 'openai/text-embedding-3-small', value: 'openai/text-embedding-3-small' },
]
