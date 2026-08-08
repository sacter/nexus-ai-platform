import { useQuery, useMutation, useQueryClient } from '@tanstack/vue-query'
import { toValue, type MaybeRefOrGetter } from 'vue'
import { ElMessage } from 'element-plus'
import { documentsApi } from '@/modules/knowledge/api/document.api'
import type { Document, DocumentVersion } from '@/modules/knowledge/types/document'

// ============================================
// Queries
// ============================================

/** 获取知识库下的文档列表 */
export function useDocuments(kbId: MaybeRefOrGetter<string>) {
  return useQuery({
    queryKey: ['documents', kbId],
    queryFn: () => documentsApi.list(toValue(kbId)),
    enabled: () => !!toValue(kbId),
  })
}

/** 分页查询知识库下的文档列表（列表页用；选择器/上传仍走全量 useDocuments） */
export function usePagedDocuments(
  kbId: MaybeRefOrGetter<string>,
  page: MaybeRefOrGetter<number>,
  pageSize: MaybeRefOrGetter<number>,
) {
  return useQuery({
    queryKey: ['documents', kbId, 'paged', page, pageSize],
    queryFn: () =>
      documentsApi.listPaged(toValue(kbId), {
        page: toValue(page),
        pageSize: toValue(pageSize),
      }),
    enabled: () => !!toValue(kbId),
  })
}

/** 获取单个文档详情 */
export function useDocument(kbId: MaybeRefOrGetter<string>, docId: MaybeRefOrGetter<string>) {
  return useQuery({
    queryKey: ['document', kbId, docId],
    queryFn: () => documentsApi.get(toValue(kbId), toValue(docId)),
    enabled: () => !!toValue(kbId) && !!toValue(docId),
  })
}

/** 获取文档版本历史 */
export function useDocumentVersions(
  kbId: MaybeRefOrGetter<string>,
  docId: MaybeRefOrGetter<string>,
) {
  return useQuery({
    queryKey: ['documentVersions', kbId, docId],
    queryFn: () => documentsApi.getVersions(toValue(kbId), toValue(docId)),
    enabled: () => !!toValue(kbId) && !!toValue(docId),
  })
}

/** 获取下载 URL */
export function useDownloadUrl(
  kbId: MaybeRefOrGetter<string>,
  docId: MaybeRefOrGetter<string>,
  versionId?: MaybeRefOrGetter<string | undefined>,
) {
  return useQuery({
    queryKey: ['downloadUrl', kbId, docId, versionId],
    queryFn: () =>
      documentsApi.getDownloadUrl(
        toValue(kbId),
        toValue(docId),
        toValue(versionId),
      ),
    enabled: () => !!toValue(kbId) && !!toValue(docId),
  })
}

// ============================================
// Mutations
// ============================================

/** 保存元数据（上传后回写） */
export function useSaveMeta() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({
      kbId,
      data,
    }: {
      kbId: string
      data: Parameters<typeof documentsApi.saveMeta>[1]
    }) => documentsApi.saveMeta(kbId, data),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['documents', variables.kbId] })
    },
  })
}

/** 更新文档 */
export function useUpdateDocument() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({
      kbId,
      id,
      data,
    }: {
      kbId: string
      id: string
      data: Partial<Document>
    }) => documentsApi.update(kbId, id, data),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: ['documents', variables.kbId],
      })
      queryClient.invalidateQueries({
        queryKey: ['document', variables.kbId, variables.id],
      })
    },
  })
}

/** 软删除文档 */
export function useDeleteDocument() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ kbId, id }: { kbId: string; id: string }) =>
      documentsApi.delete(kbId, id),
    onSuccess: (_data, variables) => {
      ElMessage.success('文档已删除')
      queryClient.invalidateQueries({
        queryKey: ['documents', variables.kbId],
      })
    },
    onError: (err: Error) => {
      ElMessage.error(`删除失败: ${err.message}`)
    },
  })
}

/** 重新索引（重新切片 + 向量化） */
export function useReindexDocument() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ kbId, id }: { kbId: string; id: string }) =>
      documentsApi.reindex(kbId, id),
    onSuccess: (_data, variables) => {
      ElMessage.success('重新索引任务已提交')
      queryClient.invalidateQueries({
        queryKey: ['documents', variables.kbId],
      })
      queryClient.invalidateQueries({
        queryKey: ['document', variables.kbId, variables.id],
      })
    },
    onError: (err: Error) => {
      ElMessage.error(`重新索引失败: ${err.message}`)
    },
  })
}

/** 切换活跃版本 */
export function useActivateVersion() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({
      kbId,
      docId,
      versionId,
    }: {
      kbId: string
      docId: string
      versionId: string
    }) => documentsApi.activateVersion(kbId, docId, versionId),
    onSuccess: (_data, variables) => {
      ElMessage.success('已切换活跃版本')
      queryClient.invalidateQueries({
        queryKey: ['document', variables.kbId, variables.docId],
      })
      queryClient.invalidateQueries({
        queryKey: ['documentVersions', variables.kbId, variables.docId],
      })
      queryClient.invalidateQueries({
        queryKey: ['documents', variables.kbId],
      })
    },
    onError: (err: Error) => {
      ElMessage.error(`切换版本失败: ${err.message}`)
    },
  })
}
