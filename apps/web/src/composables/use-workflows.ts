import { useQuery, useMutation, useQueryClient } from '@tanstack/vue-query'
import { toValue, type MaybeRef } from 'vue'
import { workflowsApi } from '@/api/workflows'

export function useWorkflows() {
  return useQuery({ queryKey: ['workflows'], queryFn: () => workflowsApi.list() })
}

export function useWorkflow(id: MaybeRef<string>) {
  return useQuery({
    queryKey: ['workflows', id],
    queryFn: () => workflowsApi.get(toValue(id)),
    enabled: () => !!toValue(id),
  })
}

export function useCreateWorkflow() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: workflowsApi.create,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['workflows'] }),
  })
}

export function useDeleteWorkflow() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: workflowsApi.delete,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['workflows'] }),
  })
}

export function useExecuteWorkflow() {
  return useMutation({ mutationFn: ({ id, input }: { id: string; input?: unknown }) => workflowsApi.execute(id, input) })
}
