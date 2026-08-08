<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useDocuments } from '@/modules/knowledge/composables/useDocuments'
import { useChunks } from '@/modules/knowledge/composables/useChunks'

const props = defineProps<{
  kbId: string
  /** '' = 全部文档 */
  documentId: string
}>()

const emit = defineEmits<{
  (e: 'update:documentId', value: string): void
}>()

const page = ref(1)
const pageSize = ref(20)

// 受控文档选择：getter 读父组件状态，setter 回传
const selectedDocId = computed({
  get: () => props.documentId,
  set: (val: string) => emit('update:documentId', val),
})

// props.documentId 是普通 string，须包成 computed 才能让 vue-query 响应式追踪
const documentIdRef = computed(() => props.documentId)

const { data: docs } = useDocuments(props.kbId)
const { data: chunkData, isLoading } = useChunks(props.kbId, documentIdRef, page, pageSize)

// 外部 documentId 变化（切片详情点击/选择器切换/重置）→ 回到第 1 页
watch(
  documentIdRef,
  () => {
    page.value = 1
  },
)

const items = computed(() => chunkData.value?.items ?? [])
const total = computed(() => chunkData.value?.total ?? 0)

const selectedDocName = computed(() => {
  if (!props.documentId) return ''
  return docs.value?.find((d) => d.id === props.documentId)?.name ?? ''
})

const emptyText = computed(() =>
  props.documentId
    ? `文档「${selectedDocName.value || props.documentId}」暂无切片数据`
    : '暂无切片数据',
)
</script>

<template>
  <div>
    <div class="mb-4">
      <el-select v-model="selectedDocId" style="width: 260px">
        <el-option label="全部文档" value="" />
        <el-option v-for="d in docs || []" :key="d.id" :label="d.name" :value="d.id" />
      </el-select>
    </div>

    <el-table
      :data="items"
      v-loading="isLoading"
      border
      :empty-text="emptyText"
    >
      <el-table-column type="expand">
        <template #default="{ row }">
          <div class="px-4 py-2 text-sm leading-6 whitespace-pre-wrap" style="color: var(--foreground)">
            {{ row.content }}
          </div>
        </template>
      </el-table-column>

      <el-table-column v-if="!props.documentId" label="文档" min-width="180" show-overflow-tooltip>
        <template #default="{ row }">{{ row.documentName }}</template>
      </el-table-column>

      <el-table-column label="页码 · 序号" width="110" align="center">
        <template #default="{ row }">P{{ row.page }} · #{{ row.chunkIndex }}</template>
      </el-table-column>

      <el-table-column label="内容" min-width="320">
        <template #default="{ row }">
          <div class="chunk-preview">{{ row.content }}</div>
        </template>
      </el-table-column>

      <el-table-column label="Token" width="90" align="right">
        <template #default="{ row }">{{ row.tokenCount }}</template>
      </el-table-column>

      <el-table-column label="向量化状态" width="160" align="center">
        <template #default="{ row }">
          <el-tag v-if="row.isEmbedded" type="success" size="small">
            已向量化 · {{ row.embeddingModels.join(', ') }}
          </el-tag>
          <el-tag v-else type="warning" size="small">未向量化</el-tag>
        </template>
      </el-table-column>
    </el-table>

    <div v-if="total > 0" class="flex justify-end mt-4">
      <el-pagination
        v-model:current-page="page"
        v-model:page-size="pageSize"
        :total="total"
        :page-sizes="[20, 50, 100]"
        layout="total, sizes, prev, pager, next"
      />
    </div>
  </div>
</template>

<style scoped>
.chunk-preview {
  color: var(--foreground, #303133);
  overflow: hidden;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}
</style>
