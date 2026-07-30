import { useQuery, useMutation, useQueryClient } from '@tanstack/vue-query'
import { toValue, type MaybeRef } from 'vue'
import { aiApplicationsApi } from '@/api/ai-applications'

export function useAiApplications() {
  return useQuery({
    queryKey: ['ai-applications'],
    queryFn: () => aiApplicationsApi.list(),
  })
}

export function useAiApplication(id: MaybeRef<string>) {
  return useQuery({
    queryKey: ['ai-applications', id],
    queryFn: () => aiApplicationsApi.get(toValue(id)),
    enabled: () => !!toValue(id),
  })
}

export function useCreateAiApplication() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: aiApplicationsApi.create,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['ai-applications'] }),
  })
}

export function useDeleteAiApplication() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: aiApplicationsApi.delete,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['ai-applications'] }),
  })
}
