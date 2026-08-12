/** 批量向量化接口（Pipeline 与 Service 共用） */
export interface BatchEmbedder {
  embed(texts: string[]): Promise<number[][]>;
}
