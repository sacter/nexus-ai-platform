import http from '@/api/client'
import type { WorkflowType } from '@nexus/config'
import type { ChatMessage, ChatSession } from '../types/chat'

export interface CreateSessionPayload {
  title: string
  kbId?: string
  promptTemplateId?: string
  aiApplicationId?: string
  workflowId?: string
  workflowType: WorkflowType
}

export const chatApi = {
  listSessions(): Promise<ChatSession[]> {
    return http.get('/chat/sessions')
  },
  getSession(id: string): Promise<ChatSession> {
    return http.get(`/chat/sessions/${id}`)
  },
  createSession(data: CreateSessionPayload): Promise<ChatSession> {
    return http.post('/chat/sessions', data)
  },
  deleteSession(id: string): Promise<void> {
    return http.delete(`/chat/sessions/${id}`)
  },
  getMessages(sessionId: string): Promise<ChatMessage[]> {
    return http.get(`/chat/sessions/${sessionId}/messages`)
  },
  sendMessage(sessionId: string, content: string): Promise<ChatMessage> {
    return http.post(`/chat/sessions/${sessionId}/messages`, { content })
  },
  sendFeedback(messageId: string, action: 'like' | 'dislike', comment?: string): Promise<void> {
    // 线字段为 rating（对齐后端契约 POST /chat/messages/:id/feedback body {rating, comment?}）
    return http.post(`/chat/messages/${messageId}/feedback`, { rating: action, comment })
  },
}
