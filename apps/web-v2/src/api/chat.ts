import http from './client'

export const chatApi = {
  listSessions: () => http.get('/api/v1/chat/sessions'),
  getSession: (id: string) => http.get(`/api/v1/chat/sessions/${id}`),
  createSession: (data?: unknown) => http.post('/api/v1/chat/sessions', data || {}),
  sendMessage: (sessionId: string, content: string) =>
    http.post(`/api/v1/chat/sessions/${sessionId}/messages`, { content }),
  getMessages: (sessionId: string) =>
    http.get(`/api/v1/chat/sessions/${sessionId}/messages`),
}
