import { useQuery, useMutation, useQueryClient } from '@tanstack/vue-query'
import { toValue, type MaybeRef } from 'vue'
import { modelsApi } from '@/api/models'

export function useModels() {
  return useQuery({ queryKey: ['models'], queryFn: () => modelsApi.list() })
}
export function useModel(id: MaybeRef<string>) {
  return useQuery({ queryKey: ['models', id], queryFn: () => modelsApi.get(toValue(id)), enabled: () => !!toValue(id) })
}
export function useCreateModel() {
  const queryClient = useQueryClient()
  return useMutation({ mutationFn: modelsApi.create, onSuccess: () => queryClient.invalidateQueries({ queryKey: ['models'] }) })
}
export function useDeleteModel() {
  const queryClient = useQueryClient()
  return useMutation({ mutationFn: modelsApi.delete, onSuccess: () => queryClient.invalidateQueries({ queryKey: ['models'] }) })
}
