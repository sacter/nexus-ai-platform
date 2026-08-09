import { SearchResult } from '../dto/search.dto';

export interface RetrieveParams {
  query: string;
  queryVector: number[];
  kbId: string;
  modelName: string;
  topK: number;
}

export interface RetrieveResult {
  chunkId: string;
  documentId: string;
  documentName: string;
  page: number;
  content: string;
  score: number;
  versionNumber: number;
}

export abstract class BaseRetriever {
  abstract readonly name: string;

  abstract retrieve(params: RetrieveParams): Promise<RetrieveResult[]>;
}
