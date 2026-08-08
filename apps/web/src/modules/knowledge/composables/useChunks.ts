import { useQuery } from '@tanstack/vue-query'
import { toValue, type MaybeRefOrGetter } from 'vue'
import { chunksApi } from '@/modules/knowledge/api/chunk.api'

/** 分页查询切片（documentId 为空 = 全部文档） */
export function useChunks(
  kbId: MaybeRefOrGetter<string>,
  documentId: MaybeRefOrGetter<string>,
  page: MaybeRefOrGetter<number>,
  pageSize: MaybeRefOrGetter<number>,
) {
  return useQuery({
    queryKey: ['chunks', kbId, documentId, page, pageSize],
    queryFn: () =>
      chunksApi.list(toValue(kbId), {
        documentId: toValue(documentId) || undefined,
        page: toValue(page),
        pageSize: toValue(pageSize),
      }),
    enabled: () => !!toValue(kbId),
  })
}
