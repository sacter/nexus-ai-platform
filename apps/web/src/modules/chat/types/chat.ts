export type MessagePhase =
  | 'idle' | 'pendingCreate' | 'retrieving' | 'reranking'
  | 'generating' | 'done' | 'error' | 'aborted'

export interface TokenUsage {
  promptTokens: number
  completionTokens: number
  totalTokens: number
}

export interface Citation {
  chunkId?: string
  documentName: string
  page?: number
  snippet?: string
  score?: number
}

export interface ChatStreamEvent {
  type: 'step' | 'citations' | 'delta' | 'done' | 'error'
  data:
    | { step: 'retrieval' | 'reranking' | 'generating'; message?: string }
    | Citation[]
    | { content: string }
    | { messageId: string; usage?: TokenUsage; citations?: Citation[] }
    | { code?: string; message: string }
}

export interface ChatMessage {
  id?: string
  tempId?: string
  sessionId: string
  role: 'user' | 'assistant' | 'system'
  content: string
  citations?: Citation[]
  metadata?: { latencyMs?: number; model?: string; executionId?: string; truncated?: boolean }
  promptTokens?: number
  completionTokens?: number
  totalTokens?: number
  feedback?: 'like' | 'dislike' | null
  streaming?: boolean
  phase?: MessagePhase
  error?: string
  createdAt?: string
}

export interface ChatSession {
  id: string
  title: string
  workflowType?: string
  kbId?: string
  aiApplicationId?: string
  lastMessage?: { content: string; role: string; createdAt: string }
  createdAt: string
}
