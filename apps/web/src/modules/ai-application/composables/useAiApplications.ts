import { useQuery, useMutation, useQueryClient } from '@tanstack/vue-query'
import { toValue, type MaybeRef } from 'vue'
import { aiApplicationsApi } from '@/modules/ai-application/api/ai-application.api'
import type {
  CreateAiApplicationInput,
  UpdateAiApplicationInput,
} from '@/modules/ai-application/types/ai-application'

export function useAiApplications(enabled: MaybeRef<boolean> = true) {
  return useQuery({
    queryKey: ['ai-applications'],
    queryFn: () => aiApplicationsApi.list(),
    enabled: () => toValue(enabled),
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
    mutationFn: (data: CreateAiApplicationInput) =>
      aiApplicationsApi.create(data),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ['ai-applications'] }),
  })
}

export function useUpdateAiApplication() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: string
      data: UpdateAiApplicationInput
    }) => aiApplicationsApi.update(id, data),
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({ queryKey: ['ai-applications'] })
      queryClient.invalidateQueries({ queryKey: ['ai-applications', vars.id] })
    },
  })
}

export function useDeleteAiApplication() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => aiApplicationsApi.delete(id),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ['ai-applications'] }),
  })
}

export function useBindTool() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, toolId }: { id: string; toolId: string }) =>
      aiApplicationsApi.bindTool(id, toolId),
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({ queryKey: ['ai-applications'] })
      queryClient.invalidateQueries({ queryKey: ['ai-applications', vars.id] })
    },
  })
}

export function useUnbindTool() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, toolId }: { id: string; toolId: string }) =>
      aiApplicationsApi.unbindTool(id, toolId),
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({ queryKey: ['ai-applications'] })
      queryClient.invalidateQueries({ queryKey: ['ai-applications', vars.id] })
    },
  })
}
