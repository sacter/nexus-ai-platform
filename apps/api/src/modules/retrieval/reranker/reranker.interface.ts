export interface RerankInput {
  query: string;
  documents: {
    chunkId: string;
    content: string;
  }[];
}

export interface RerankOutput {
  chunkId: string;
  relevanceScore: number; // 归一化得分 [0, 1]，越高越相关
}

export interface Reranker {
  readonly name: string;
  rerank(input: RerankInput, topK?: number): Promise<RerankOutput[]>;
}
