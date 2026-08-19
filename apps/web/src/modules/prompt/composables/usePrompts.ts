import { useQuery } from '@tanstack/vue-query'
import { toValue, type MaybeRef } from 'vue'
import { promptsApi } from '@/modules/prompt/api/prompt.api'

export function usePromptTemplates(enabled: MaybeRef<boolean> = true) {
  return useQuery({
    queryKey: ['prompt-templates'],
    queryFn: () => promptsApi.list(),
    enabled: () => toValue(enabled),
  })
}
