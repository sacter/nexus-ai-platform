import { useQuery, useMutation, useQueryClient } from '@tanstack/vue-query'
import { toValue, type MaybeRef } from 'vue'
import { jobsApi } from '@/modules/knowledge/api/job.api'
import type { JobListParams } from '@/modules/knowledge/types/job'

export function useJobs(params: MaybeRef<JobListParams>) {
  return useQuery({
    queryKey: ['jobs', params],
    queryFn: () => jobsApi.list(toValue(params)),
    refetchInterval: 5000,
    placeholderData: (previousData) => previousData,
  })
}

export function useJob(id: MaybeRef<string>) {
  return useQuery({
    queryKey: ['jobs', id],
    queryFn: () => jobsApi.get(toValue(id)),
    enabled: () => !!toValue(id),
  })
}

export function useCancelJob() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => jobsApi.cancel(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['jobs'] }),
  })
}

export function useRetryJob() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => jobsApi.retry(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['jobs'] }),
  })
}
