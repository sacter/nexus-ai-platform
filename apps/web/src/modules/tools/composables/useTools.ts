import { useQuery, useMutation, useQueryClient } from '@tanstack/vue-query'
import { toValue, type MaybeRef } from 'vue'
import { toolsApi } from '@/modules/tools/api/tool.api'
export function useTools(enabled: MaybeRef<boolean> = true) {
  return useQuery({
    queryKey: ['tools'],
    queryFn: () => toolsApi.list(),
    enabled: () => toValue(enabled),
  })
}
export function useTool(id: MaybeRef<string>) { return useQuery({ queryKey: ['tools', id], queryFn: () => toolsApi.get(toValue(id)), enabled: () => !!toValue(id) }) }
export function useCreateTool() { const qc = useQueryClient(); return useMutation({ mutationFn: toolsApi.create, onSuccess: () => qc.invalidateQueries({ queryKey: ['tools'] }) }) }
export function useDeleteTool() { const qc = useQueryClient(); return useMutation({ mutationFn: toolsApi.delete, onSuccess: () => qc.invalidateQueries({ queryKey: ['tools'] }) }) }
