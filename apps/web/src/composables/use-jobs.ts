import { useQuery, useMutation, useQueryClient } from '@tanstack/vue-query'
import { toValue, type MaybeRef } from 'vue'
import { jobsApi } from '@/api/jobs'
export function useJobs() { return useQuery({ queryKey: ['jobs'], queryFn: () => jobsApi.list(), refetchInterval: 5000 }) }
export function useJob(id: MaybeRef<string>) { return useQuery({ queryKey: ['jobs', id], queryFn: () => jobsApi.get(toValue(id)), enabled: () => !!toValue(id) }) }
export function useCancelJob() { const qc = useQueryClient(); return useMutation({ mutationFn: jobsApi.cancel, onSuccess: () => qc.invalidateQueries({ queryKey: ['jobs'] }) }) }
