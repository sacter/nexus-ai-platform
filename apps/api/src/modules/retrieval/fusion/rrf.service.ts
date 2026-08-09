import { Injectable } from '@nestjs/common';
import { RetrieveResult } from '../retrievers/base-retriever';
import { SEARCH_DEFAULTS } from '../dto/search.dto';

export interface RrfFusedResult {
  chunkId: string;
  documentId: string;
  documentName: string;
  page: number;
  content: string;
  score: number; // RRF score
  versionNumber: number;
  denseRank: number | null;
  sparseRank: number | null;
}

@Injectable()
export class RrfService {
  /**
   * Reciprocal Rank Fusion
   *
   * score(d) = Σ 1/(k + rank_i(d))
   *
   * - k=60 (default) smooths the rank penalty
   * - Ranks are 1-indexed
   * - Deduplicates by chunkId, sums scores from both retrievers
   * - Falls back to single-list if either input is empty
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

    // Helper: add scores from one ranked list
    const addScores = (
      results: RetrieveResult[],
      rankKey: 'denseRank' | 'sparseRank',
    ) => {
      for (let i = 0; i < results.length; i++) {
        const rank = i + 1; // 1-indexed
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

    // Sort by RRF score descending, take topK
    const fused: RrfFusedResult[] = Array.from(scoreMap.values())
      .sort((a, b) => b.rrfScore - a.rrfScore)
      .slice(0, topK)
      .map((entry) => ({
        chunkId: entry.item.chunkId,
        documentId: entry.item.documentId,
        documentName: entry.item.documentName,
        page: entry.item.page,
        content: entry.item.content,
        score: Math.round(entry.rrfScore * 1e6) / 1e6, // round to 6 decimal places
        versionNumber: entry.item.versionNumber,
        denseRank: entry.denseRank,
        sparseRank: entry.sparseRank,
      }));

    return fused;
  }
}
