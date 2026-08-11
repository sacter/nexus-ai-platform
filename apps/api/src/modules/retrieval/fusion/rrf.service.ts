import { Injectable } from '@nestjs/common';
import { RetrieveResult } from '../retrievers/base-retriever';
import { SEARCH_DEFAULTS } from '../dto/search.dto';

export interface RrfFusedResult {
  chunkId: string;
  documentId: string;
  documentName: string;
  page: number;
  content: string;
  tokenCount: number;
  score: number; // RRF 融合分数
  versionNumber: number;
  denseRank: number | null;
  sparseRank: number | null;
}

@Injectable()
export class RrfService {
  /**
   * Reciprocal Rank Fusion 融合算法
   *
   * score(d) = Σ 1/(k + rank_i(d))
   *
   * - k=60（默认），平滑排名惩罚
   * - 排名从 1 开始（1-indexed）
   * - 按 chunkId 去重，累加两路检索器分数
   * - 若某路结果为空，自动退化为单路
   */
  fuse(
    denseResults: RetrieveResult[],
    sparseResults: RetrieveResult[],
    k: number = SEARCH_DEFAULTS.rrfK,
    topK: number = SEARCH_DEFAULTS.topK,
  ): RrfFusedResult[] {
    const scoreMap = new Map<
      string,
      {
        item: RetrieveResult;
        denseRank: number | null;
        sparseRank: number | null;
        rrfScore: number;
      }
    >();

    // 辅助函数：将一路排序列表的分数累加到 scoreMap
    const addScores = (
      results: RetrieveResult[],
      rankKey: 'denseRank' | 'sparseRank',
    ) => {
      for (let i = 0; i < results.length; i++) {
        const rank = i + 1; // 1-indexed，排名从 1 开始
        const existing = scoreMap.get(results[i].chunkId);
        const contrib = 1 / (k + rank);

        if (existing) {
          existing.rrfScore += contrib;
          existing[rankKey] = rank;
        } else {
          scoreMap.set(results[i].chunkId, {
            item: results[i],
            denseRank: null,
            sparseRank: null,
            rrfScore: contrib,
          });
          scoreMap.get(results[i].chunkId)![rankKey] = rank;
        }
      }
    };

    addScores(denseResults, 'denseRank');
    addScores(sparseResults, 'sparseRank');

    // 按 RRF 分数降序排列，取 topK
    const fused: RrfFusedResult[] = Array.from(scoreMap.values())
      .sort((a, b) => b.rrfScore - a.rrfScore)
      .slice(0, topK)
      .map((entry) => ({
        chunkId: entry.item.chunkId,
        documentId: entry.item.documentId,
        documentName: entry.item.documentName,
        page: entry.item.page,
        content: entry.item.content,
        tokenCount: entry.item.tokenCount,
        score: Math.round(entry.rrfScore * 1e6) / 1e6, // 保留 6 位小数
        versionNumber: entry.item.versionNumber,
        denseRank: entry.denseRank,
        sparseRank: entry.sparseRank,
      }));

    return fused;
  }
}
