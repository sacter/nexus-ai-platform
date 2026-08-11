import {
  IsString,
  IsUUID,
  IsOptional,
  IsInt,
  IsBoolean,
  IsIn,
  Min,
  Max,
  IsNotEmpty,
} from 'class-validator';

// ── 请求参数 ──

export class SearchDto {
  @IsString()
  @IsNotEmpty()
  query!: string;

  @IsUUID('4')
  kbId!: string;

  @IsOptional()
  @IsIn(['vector', 'hybrid'])
  strategy?: 'vector' | 'hybrid';

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  topK?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(200)
  denseTopK?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(200)
  sparseTopK?: number;

  @IsOptional()
  @IsBoolean()
  rerank?: boolean;
}

// ── 响应结果 ──

export interface Citation {
  documentName: string;
  page: number;
  version: string;
  snippet: string;
}

export interface SearchResult {
  chunkId: string;
  documentId: string;
  documentName: string;
  page: number;
  content: string;
  score: number;
  tokenCount: number;
  citation: Citation;
}

export interface SearchResponse {
  results: SearchResult[];
  strategy: 'vector' | 'hybrid';
  totalCandidates: number;
}

// ── 默认配置（来自 CLAUDE.md 2.3 节） ──

export const SEARCH_DEFAULTS = {
  denseTopK: 20,
  sparseTopK: 20,
  rrfK: 60,
  topK: 5,
  rerankTopK: 5,
} as const;
