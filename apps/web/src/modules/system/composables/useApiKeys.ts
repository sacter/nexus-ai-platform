import { useQuery, useMutation, useQueryClient } from '@tanstack/vue-query'
import { apiKeysApi } from '@/modules/system/api/api-keys.api'

export function useApiKeys() {
  return useQuery({ queryKey: ['api-keys'], queryFn: () => apiKeysApi.list() })
}

export function useCreateApiKey() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: apiKeysApi.create,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['api-keys'] }),
  })
}

export function useUpdateApiKey() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Parameters<typeof apiKeysApi.update>[1] }) =>
      apiKeysApi.update(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['api-keys'] }),
  })
}

export function useDeleteApiKey() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: apiKeysApi.delete,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['api-keys'] }),
  })
}
