import { useMutation } from '@tanstack/vue-query'
import { ElMessage } from 'element-plus'
import { retrievalApi } from '@/modules/knowledge/api/retrieval.api'
import type { SearchRequest } from '@/modules/knowledge/types/retrieval'

/** 知识检索 mutation —— 用户触发搜索，不走自动 query */
export function useRetrieval() {
  return useMutation({
    mutationFn: (params: SearchRequest) => retrievalApi.search(params),
    onError: (err: Error) => {
      ElMessage.error(`检索失败: ${err.message}`)
    },
  })
}
