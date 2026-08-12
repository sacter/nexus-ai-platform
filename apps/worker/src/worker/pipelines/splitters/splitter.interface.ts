/** 分割后的 chunk */
export interface SplitChunk {
  page: number;
  chunkIndex: number;
  content: string;
  contentHash: string;
  tokenCount: number;
  metadata?: Record<string, unknown>;
}

export interface SplitOptions {
  chunkSize?: number; // 字符数上限（近似 token）
  chunkOverlap?: number;
}

export interface TextSplitterPort {
  split(
    pages: Array<{
      pageNumber: number;
      content: string;
      metadata?: Record<string, unknown>;
    }>,
    opts?: SplitOptions,
  ): SplitChunk[];
}
