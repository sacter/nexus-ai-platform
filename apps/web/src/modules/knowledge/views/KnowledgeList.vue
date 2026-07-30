<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { Plus } from '@element-plus/icons-vue'
import { useKnowledgeBases, useDeleteKnowledgeBase } from '@/modules/knowledge/composables/useKnowledge'
import KbCard from '@/modules/knowledge/components/KnowledgeCard.vue'
import KbCreateDialog from '@/modules/knowledge/components/KnowledgeCreateDialog.vue'

const router = useRouter()
const { data: kbs, isLoading } = useKnowledgeBases()
const deleteMutation = useDeleteKnowledgeBase()

const createDialogVisible = ref(false)

function handleView(id: string) { router.push(`/knowledge-bases/${id}`) }
function handleEdit(id: string) { router.push(`/knowledge-bases/${id}`) }
function handleDelete(id: string) { deleteMutation.mutate(id) }
</script>

<template>
  <div>
    <div class="flex items-center justify-between mb-6">
      <h1 class="text-2xl font-semibold" style="color: var(--foreground)">知识库</h1>
      <el-button type="primary" :icon="Plus" @click="createDialogVisible = true">创建知识库</el-button>
    </div>

    <div v-if="isLoading" class="flex justify-center py-12">
      <el-icon class="is-loading" :size="24"><Plus /></el-icon>
    </div>

    <div v-else-if="kbs && Array.isArray(kbs) && kbs.length > 0" class="grid grid-cols-3 gap-4">
      <KbCard
        v-for="kb in kbs"
        :key="(kb as Record<string,string>).id"
        :id="(kb as Record<string,string>).id"
        :name="(kb as Record<string,string>).name"
        @view="handleView"
        @edit="handleEdit"
        @delete="handleDelete"
      />
    </div>

    <el-empty v-else description="暂无知识库" />

    <KbCreateDialog v-model:visible="createDialogVisible" />
  </div>
</template>
