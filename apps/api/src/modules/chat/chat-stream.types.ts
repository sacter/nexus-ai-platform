/**
 * SSE 事件契约 —— 严格对齐前端
 * apps/web/src/modules/chat/types/chat.ts 的 ChatStreamEvent。
 * 由 fetch-sse.transport.ts 逐行解析：data: {JSON}\n\n，末尾 data: [DONE]\n\n。
 */
export type ChatStreamEvent =
  | {
      type: 'step';
      data: {
        step: 'retrieval' | 'reranking' | 'generating';
        message?: string;
      };
    }
  | { type: 'citations'; data: CitationDto[] }
  | { type: 'delta'; data: { content: string } }
  | {
      type: 'done';
      data: {
        messageId: string;
        usage?: TokenUsage;
        citations?: CitationDto[];
      };
    }
  | { type: 'error'; data: { code?: string; message: string } };

/** 引用：后端 SearchResult.citation → 前端 Citation 形状（chunkId/documentName/page/snippet/score） */
export interface CitationDto {
  documentName: string;
  page?: number;
  snippet?: string;
  score?: number;
  chunkId?: string;
}

export interface TokenUsage {
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
}
