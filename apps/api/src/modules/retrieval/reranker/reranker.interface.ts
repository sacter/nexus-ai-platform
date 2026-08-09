export interface RerankInput {
  query: string;
  documents: {
    chunkId: string;
    content: string;
  }[];
}

export interface RerankOutput {
  chunkId: string;
  relevanceScore: number; // normalized [0, 1], higher = more relevant
}

export interface Reranker {
  readonly name: string;
  rerank(input: RerankInput, topK?: number): Promise<RerankOutput[]>;
}
