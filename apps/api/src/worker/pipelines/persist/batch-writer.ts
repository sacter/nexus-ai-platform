import { SplitChunk } from '../splitters/splitter.interface';

/** 将 SplitChunk 转为 Prisma createMany data */
export function toChunkRows(versionId: string, chunks: SplitChunk[]) {
  return chunks.map((c) => ({
    versionId,
    page: c.page,
    chunkIndex: c.chunkIndex,
    content: c.content,
    contentHash: c.contentHash,
    tokenCount: c.tokenCount,
    metadata: (c.metadata ?? {}) as object,
  }));
}
