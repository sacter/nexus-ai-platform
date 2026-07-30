<script setup lang="ts">
import { ref } from 'vue'
import { useRoute } from 'vue-router'
import { useDocuments, useDeleteDocument } from '@/modules/knowledge/composables/useDocuments'
import DocumentTable from '@/modules/knowledge/components/DocumentTable.vue'
import DocumentUpload from '@/modules/knowledge/components/DocumentUpload.vue'

const route = useRoute()
const kbId = ref(route.query.kbId as string || '')
const { data: docs, isLoading } = useDocuments(kbId)
const deleteMutation = useDeleteDocument()

function handleDelete(id: string) {
  deleteMutation.mutate({ kbId: kbId.value, id })
}
</script>

<template>
  <div>
    <h1 class="text-2xl font-semibold mb-6" style="color: var(--foreground)">文档管理</h1>

    <div class="mb-6">
      <DocumentUpload :kb-id="kbId" />
    </div>

    <DocumentTable
      :documents="(docs as unknown[]) || []"
      :loading="isLoading"
      @delete="handleDelete"
    />
  </div>
</template>
