/** Embedding Provider 统一接口 */
export interface EmbeddingProvider {
  readonly model: string;
  readonly dimension: number;
  /** 批量向量化，输入输出顺序一一对应 */
  embed(texts: string[]): Promise<number[][]>;
}
