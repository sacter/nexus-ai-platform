import { useQuery, useMutation, useQueryClient } from '@tanstack/vue-query'
import { toValue, type MaybeRef } from 'vue'
import { knowledgeBasesApi } from '@/modules/knowledge/api/knowledge.api'

export function useKnowledgeBases(enabled: MaybeRef<boolean> = true) {
  return useQuery({
    queryKey: ['knowledge-base'],
    queryFn: () => knowledgeBasesApi.list(),
    enabled: () => toValue(enabled),
  })
}

export function useKnowledgeBase(id: MaybeRef<string>) {
  return useQuery({
    queryKey: ['knowledge-base', id],
    queryFn: () => knowledgeBasesApi.get(toValue(id)),
    enabled: () => !!toValue(id),
  })
}

export function useCreateKnowledgeBase() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: knowledgeBasesApi.create,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['knowledge-base'] }),
  })
}

export function useUpdateKnowledgeBase() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: unknown }) => knowledgeBasesApi.update(id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['knowledge-base'] }),
  })
}

export function useDeleteKnowledgeBase() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: knowledgeBasesApi.delete,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['knowledge-base'] }),
  })
}
