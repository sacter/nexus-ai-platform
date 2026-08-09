import type { SearchResult } from '../dto/search.dto';

export interface RetrieveParams {
  query: string;
  queryVector: number[];
  kbId: string;
  modelName: string;
  topK: number;
}

/** Retriever raw output — extends SearchResult minus citation, plus versionNumber for downstream formatting */
export interface RetrieveResult extends Omit<SearchResult, 'citation'> {
  versionNumber: number;
}

export abstract class BaseRetriever {
  abstract readonly name: string;

  abstract retrieve(params: RetrieveParams): Promise<RetrieveResult[]>;
}
