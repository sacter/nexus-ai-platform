import { useQuery, useMutation, useQueryClient } from '@tanstack/vue-query'
import { toValue, type MaybeRef } from 'vue'
import { modelsApi } from '@/modules/models/api/model.api'
import type { ModelUpdateInput } from '@/modules/models/types/model'

export function useModels(enabled: MaybeRef<boolean> = true) {
  return useQuery({
    queryKey: ['models'],
    queryFn: () => modelsApi.list(),
    enabled: () => toValue(enabled),
  })
}
export function useModel(id: MaybeRef<string>) {
  return useQuery({ queryKey: ['models', id], queryFn: () => modelsApi.get(toValue(id)), enabled: () => !!toValue(id) })
}
export function useCreateModel() {
  const queryClient = useQueryClient()
  return useMutation({ mutationFn: modelsApi.create, onSuccess: () => queryClient.invalidateQueries({ queryKey: ['models'] }) })
}
export function useUpdateModel() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: ModelUpdateInput }) => modelsApi.update(id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['models'] }),
  })
}
export function useDeleteModel() {
  const queryClient = useQueryClient()
  return useMutation({ mutationFn: modelsApi.delete, onSuccess: () => queryClient.invalidateQueries({ queryKey: ['models'] }) })
}
