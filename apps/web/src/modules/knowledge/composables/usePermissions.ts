import { useQuery, useMutation, useQueryClient } from '@tanstack/vue-query'
import { toValue, type MaybeRef } from 'vue'
import { permissionsApi } from '@/modules/knowledge/api/permission.api'
import http from '@/api/client'
import type { KbRole } from '@/modules/knowledge/types/permission'
import type { UserInfo } from '@/modules/system/auth/api/auth.api'

export function useKbPermissions(kbId: MaybeRef<string>) {
  return useQuery({
    queryKey: ['knowledge-base', kbId, 'permissions'],
    queryFn: () => permissionsApi.list(toValue(kbId)),
    enabled: () => !!toValue(kbId),
  })
}

export function useAssignPermission() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ kbId, userId, role }: { kbId: string; userId: string; role: KbRole }) =>
      permissionsApi.assign(kbId, userId, role),
    onSuccess: (_data, { kbId }) =>
      queryClient.invalidateQueries({ queryKey: ['knowledge-base', kbId, 'permissions'] }),
  })
}

export function useBatchAssignPermissions() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({
      kbId,
      permissions,
    }: {
      kbId: string
      permissions: { userId: string; role: KbRole }[]
    }) => permissionsApi.batchAssign(kbId, permissions),
    onSuccess: (_data, { kbId }) =>
      queryClient.invalidateQueries({ queryKey: ['knowledge-base', kbId, 'permissions'] }),
  })
}

export function useUpdatePermission() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({
      kbId,
      permissionId,
      role,
    }: {
      kbId: string
      permissionId: string
      role: KbRole
    }) => permissionsApi.update(kbId, permissionId, role),
    onSuccess: (_data, { kbId }) =>
      queryClient.invalidateQueries({ queryKey: ['knowledge-base', kbId, 'permissions'] }),
  })
}

export function useRemovePermission() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ kbId, permissionId }: { kbId: string; permissionId: string }) =>
      permissionsApi.remove(kbId, permissionId),
    onSuccess: (_data, { kbId }) =>
      queryClient.invalidateQueries({ queryKey: ['knowledge-base', kbId, 'permissions'] }),
  })
}

export function useAllUsers() {
  return useQuery({
    queryKey: ['users'],
    queryFn: () => http.get<UserInfo[]>('/user'),
  })
}

export function useMyPermission(kbId: MaybeRef<string>) {
  return useQuery({
    queryKey: ['knowledge-base', kbId, 'permissions', 'me'],
    queryFn: () => permissionsApi.myPermission(toValue(kbId)),
    enabled: () => !!toValue(kbId),
  })
}
