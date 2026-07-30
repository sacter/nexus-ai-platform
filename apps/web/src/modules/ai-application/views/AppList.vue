<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { Plus } from '@element-plus/icons-vue'
import { useAiApplications, useDeleteAiApplication } from '@/modules/ai-application/composables/useAiApplications'
import AppCard from '@/modules/ai-application/components/AppCard.vue'

const router = useRouter()
const { data: apps, isLoading } = useAiApplications()
const deleteMutation = useDeleteAiApplication()

function handleView(id: string) { router.push(`/ai-applications/${id}`) }
function handleDelete(id: string) { deleteMutation.mutate(id) }
</script>

<template>
  <div>
    <div class="flex items-center justify-between mb-6">
      <h1 class="text-2xl font-semibold" style="color: var(--foreground)">AI 应用</h1>
      <el-button type="primary" :icon="Plus" @click="router.push('/ai-applications/new')">创建应用</el-button>
    </div>

    <div v-if="isLoading" class="flex justify-center py-12">
      <el-icon class="is-loading" :size="24"><Plus /></el-icon>
    </div>

    <div v-else-if="apps && Array.isArray(apps) && apps.length > 0" class="grid grid-cols-3 gap-4">
      <AppCard
        v-for="app in apps"
        :key="(app as Record<string,string>).id"
        :id="(app as Record<string,string>).id"
        :name="(app as Record<string,string>).name"
        @view="handleView"
        @delete="handleDelete"
      />
    </div>

    <el-empty v-else description="暂无 AI 应用" />
  </div>
</template>
