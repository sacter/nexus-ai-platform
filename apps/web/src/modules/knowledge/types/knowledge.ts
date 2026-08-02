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
