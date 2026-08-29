import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query'
import { toValue, type MaybeRef } from 'vue'
import { workflowsApi } from '@/modules/workflow/api/workflow.api'
import type { CreateWorkflowInput, RunWorkflowInput, UpdateWorkflowInput } from '@/modules/workflow/types/workflow'

export function useWorkflows(enabled: MaybeRef<boolean> = true) {
  return useQuery({
    queryKey: ['workflows'],
    queryFn: () => workflowsApi.list(),
    enabled: () => toValue(enabled),
  })
}

export function useWorkflow(id: MaybeRef<string>) {
  return useQuery({
    queryKey: ['workflows', id],
    queryFn: () => workflowsApi.get(toValue(id)),
    enabled: () => !!toValue(id),
  })
}

export function useCreateWorkflow() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: CreateWorkflowInput) => workflowsApi.create(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['workflows'] }),
  })
}

export function useUpdateWorkflow() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateWorkflowInput }) =>
      workflowsApi.update(id, data),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ['workflows'] })
      qc.invalidateQueries({ queryKey: ['workflows', vars.id] })
    },
  })
}

export function useDeleteWorkflow() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => workflowsApi.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['workflows'] }),
  })
}

export function useRunWorkflow() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data?: RunWorkflowInput }) =>
      workflowsApi.run(id, data ?? {}),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ['workflows', vars.id, 'executions'] })
    },
  })
}

export function useWorkflowExecutions(workflowId: MaybeRef<string>) {
  return useQuery({
    queryKey: ['workflows', workflowId, 'executions'],
    queryFn: () => workflowsApi.listExecutions(toValue(workflowId)),
    enabled: () => !!toValue(workflowId),
  })
}

export function useWorkflowExecution(
  workflowId: MaybeRef<string>,
  execId: MaybeRef<string>,
) {
  return useQuery({
    queryKey: ['workflows', workflowId, 'executions', execId],
    queryFn: () => workflowsApi.getExecution(toValue(workflowId), toValue(execId)),
    enabled: () => !!toValue(workflowId) && !!toValue(execId),
  })
}
