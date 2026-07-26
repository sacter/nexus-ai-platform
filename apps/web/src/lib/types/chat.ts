export interface ChatSession {
  id: string;
  title: string;
  workflowType?: string;
  createdAt: string;
}

export interface ChatMessage {
  id: string;
  sessionId: string;
  role: 'user' | 'assistant';
  content: string;
  citations?: Citation[];
  createdAt: string;
}

export interface Citation {
  documentName: string;
  page: number;
  snippet: string;
  score: number;
}
