export type MessagePhase =
  | 'idle' | 'retrieving' | 'reranking'
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

export type ChatStreamEvent =
  | { type: 'step'; data: { step: 'retrieval' | 'reranking' | 'generating'; message?: string } }
  | { type: 'citations'; data: Citation[] }
  | { type: 'delta'; data: { content: string } }
  | { type: 'done'; data: { messageId: string; usage?: TokenUsage; citations?: Citation[] } }
  | { type: 'error'; data: { code?: string; message: string } }

export interface ChatMessage {
  id?: string
  tempId?: string
  sessionId: string
  role: 'user' | 'assistant' | 'system'
  content: string
  citations?: Citation[]
  metadata?: { latencyMs?: number; model?: string; executionId?: string; truncated?: boolean; feedback?: 'like' | 'dislike' | null }
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
  modelId?: string
  aiApplicationId?: string
  lastMessage?: { content: string; role: string; createdAt: string }
  createdAt: string
}
