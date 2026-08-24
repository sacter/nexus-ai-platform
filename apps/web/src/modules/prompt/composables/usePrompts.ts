import { useQuery, useMutation, useQueryClient } from '@tanstack/vue-query'
import { toValue, type MaybeRef } from 'vue'
import { promptsApi } from '../api/prompt.api'
import type { UpdatePromptTemplateInput } from '../types/prompt'

export function usePromptTemplates(enabled: MaybeRef<boolean> = true) {
  return useQuery({
    queryKey: ['prompt-templates'],
    queryFn: () => promptsApi.list(),
    enabled: () => toValue(enabled),
  })
}

export function usePromptTemplate(id: MaybeRef<string>) {
  return useQuery({
    queryKey: ['prompt-templates', id],
    queryFn: () => promptsApi.get(toValue(id)),
    enabled: () => !!toValue(id),
  })
}

/** 版本历史（新→旧）；「当前」由行数据的 currentVersionId 决定 */
export function usePromptVersions(id: MaybeRef<string>) {
  return useQuery({
    queryKey: ['prompt-templates', id, 'versions'],
    queryFn: () => promptsApi.listVersions(toValue(id)),
    enabled: () => !!toValue(id),
  })
}

export function useCreatePromptTemplate() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: promptsApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['prompt-templates'] })
    },
  })
}

export function useUpdatePromptTemplate() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdatePromptTemplateInput }) =>
      promptsApi.update(id, data),
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({ queryKey: ['prompt-templates'] })
      queryClient.invalidateQueries({ queryKey: ['prompt-templates', vars.id] })
    },
  })
}

export function useDeletePromptTemplate() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => promptsApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['prompt-templates'] })
    },
  })
}
