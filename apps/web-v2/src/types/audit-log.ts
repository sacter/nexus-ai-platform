export interface AuditLog {
  id: string;
  userId: string;
  action: string;
  target: string;
  createdAt: string;
}
