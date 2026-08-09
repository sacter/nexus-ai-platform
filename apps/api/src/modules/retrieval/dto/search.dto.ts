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

// ── Request ──

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

// ── Response ──

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
  citation: Citation;
}

export interface SearchResponse {
  results: SearchResult[];
  strategy: 'vector' | 'hybrid';
  totalCandidates: number;
}

// ── Defaults (from CLAUDE.md section 2.3) ──

export const SEARCH_DEFAULTS = {
  denseTopK: 20,
  sparseTopK: 20,
  rrfK: 60,
  topK: 5,
  rerankTopK: 5,
} as const;
