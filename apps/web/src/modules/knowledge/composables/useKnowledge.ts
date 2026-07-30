import { useQuery, useMutation, useQueryClient } from '@tanstack/vue-query'
import { toValue, type MaybeRef } from 'vue'
import { knowledgeBasesApi } from '@/modules/knowledge/api/knowledge.api'

export function useKnowledgeBases() {
  return useQuery({
    queryKey: ['knowledge-bases'],
    queryFn: () => knowledgeBasesApi.list(),
  })
}

export function useKnowledgeBase(id: MaybeRef<string>) {
  return useQuery({
    queryKey: ['knowledge-bases', id],
    queryFn: () => knowledgeBasesApi.get(toValue(id)),
    enabled: () => !!toValue(id),
  })
}

export function useCreateKnowledgeBase() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: knowledgeBasesApi.create,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['knowledge-bases'] }),
  })
}

export function useDeleteKnowledgeBase() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: knowledgeBasesApi.delete,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['knowledge-bases'] }),
  })
}
