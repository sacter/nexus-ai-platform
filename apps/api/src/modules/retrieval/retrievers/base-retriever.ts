import type { SearchResult } from '../dto/search.dto';

export interface RetrieveParams {
  query: string;
  queryVector: number[];
  kbId: string;
  modelName: string;
  topK: number;
}

/** 检索器原始输出 — 继承 SearchResult（去除 citation），增加 versionNumber 供下游格式化 */
export interface RetrieveResult extends Omit<SearchResult, 'citation'> {
  versionNumber: number;
}

export abstract class BaseRetriever {
  abstract readonly name: string;

  abstract retrieve(params: RetrieveParams): Promise<RetrieveResult[]>;
}
