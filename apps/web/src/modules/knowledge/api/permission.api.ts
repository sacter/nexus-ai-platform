import http from '@/api/client'
import type { KbPermission, KbRole } from '@/modules/knowledge/types/permission'

export const permissionsApi = {
  list: (kbId: string) =>
    http.get<KbPermission[]>(`/knowledge-base/${kbId}/permissions`),

  assign: (kbId: string, userId: string, role: KbRole) =>
    http.post<KbPermission>(`/knowledge-base/${kbId}/permissions`, { userId, role }),

  batchAssign: (kbId: string, permissions: { userId: string; role: KbRole }[]) =>
    http.post<KbPermission[]>(`/knowledge-base/${kbId}/permissions/batch`, { permissions }),

  update: (kbId: string, permissionId: string, role: KbRole) =>
    http.patch<KbPermission>(`/knowledge-base/${kbId}/permissions/${permissionId}`, { role }),

  remove: (kbId: string, permissionId: string) =>
    http.delete<void>(`/knowledge-base/${kbId}/permissions/${permissionId}`),

  myPermission: (kbId: string) =>
    http.get<KbPermission | null>(`/knowledge-base/${kbId}/permissions/me`),
}
