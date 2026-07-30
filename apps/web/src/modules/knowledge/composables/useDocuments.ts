import { useQuery, useMutation, useQueryClient } from '@tanstack/vue-query'
import { toValue, type MaybeRef } from 'vue'
import { documentsApi } from '@/modules/knowledge/api/document.api'

export function useDocuments(kbId: MaybeRef<string>) {
  return useQuery({
    queryKey: ['documents', kbId],
    queryFn: () => documentsApi.list(toValue(kbId)),
    enabled: () => !!toValue(kbId),
  })
}

export function useUploadDocument() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ kbId, formData }: { kbId: string; formData: FormData }) =>
      documentsApi.upload(kbId, formData),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['documents', variables.kbId] })
    },
  })
}

export function useDeleteDocument() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ kbId, id }: { kbId: string; id: string }) =>
      documentsApi.delete(kbId, id),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['documents', variables.kbId] })
    },
  })
}
