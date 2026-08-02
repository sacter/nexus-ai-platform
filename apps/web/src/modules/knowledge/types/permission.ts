export type KbRole = 'admin' | 'editor' | 'viewer'

export interface KbPermission {
  id: string
  kbId: string
  userId: string
  role: KbRole
  createdAt: string
  user?: {
    id: string
    username: string
    email: string
  }
}
