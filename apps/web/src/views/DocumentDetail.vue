<script setup lang="ts">
import { ref } from 'vue'
import { useRoute } from 'vue-router'
import { Document } from '@element-plus/icons-vue'
import { documentsApi } from '@/api/documents'
import { useQuery } from '@tanstack/vue-query'

const route = useRoute()
const docId = route.params.id as string
const kbId = ref(route.query.kbId as string || '')

const { data: doc, isLoading } = useQuery({
  queryKey: ['document', kbId, docId],
  queryFn: () => documentsApi.get(kbId.value, docId),
  enabled: () => !!kbId.value,
})

function getStatusType(status: string) {
  const map: Record<string, string> = {
    READY: 'success',
    PROCESSING: 'warning',
    UPLOADING: 'info',
    DELETED: 'danger',
  }
  return map[status] || 'info'
}

function getStatusLabel(status: string) {
  const map: Record<string, string> = {
    READY: '已就绪',
    PROCESSING: '处理中',
    UPLOADING: '上传中',
    DELETED: '已删除',
  }
  return map[status] || status
}
</script>

<template>
  <div>
    <h1 class="text-2xl font-semibold mb-1" style="color: var(--foreground)">文档详情</h1>
    <p class="text-sm mb-6" style="color: var(--foreground); opacity: 0.5">ID: {{ docId }}</p>

    <div v-if="isLoading" class="flex justify-center py-12">
      <el-icon class="is-loading" :size="24"><Document /></el-icon>
    </div>

    <el-tabs v-else-if="doc">
      <el-tab-pane label="基本信息" name="info">
        <el-card class="mt-4">
          <template #header>
            <h2 class="text-base font-semibold" style="color: var(--foreground)">Document Info</h2>
          </template>
          <div class="flex gap-4 items-center flex-wrap">
            <el-tag :type="getStatusType((doc as Record<string,string>).status)" size="small">
              {{ getStatusLabel((doc as Record<string,string>).status) }}
            </el-tag>
            <span class="text-sm" style="color: var(--foreground); opacity: 0.6">
              Chunks: {{ (doc as Record<string,string>).chunkCount || 0 }}
            </span>
            <span class="text-sm" style="color: var(--foreground); opacity: 0.6">
              版本: v{{ (doc as Record<string,string>).version || 1 }}
            </span>
            <span class="text-sm" style="color: var(--foreground); opacity: 0.6">
              创建: {{ (doc as Record<string,string>).createdAt }}
            </span>
          </div>
        </el-card>
      </el-tab-pane>

      <el-tab-pane label="版本历史" name="versions">
        <el-card class="mt-4">
          <template #header>
            <h2 class="text-base font-semibold" style="color: var(--foreground)">版本历史</h2>
          </template>
          <p class="text-sm" style="color: var(--foreground); opacity: 0.6">
            v{{ (doc as Record<string,string>).version || 1 }}
          </p>
        </el-card>
      </el-tab-pane>

      <el-tab-pane label="Chunks" name="chunks">
        <el-card class="mt-4">
          <template #header>
            <h2 class="text-base font-semibold" style="color: var(--foreground)">Chunks</h2>
          </template>
          <div class="flex flex-col gap-3">
            <div
              v-for="i in [1, 2]"
              :key="i"
              class="p-3 rounded-lg text-sm"
              style="background-color: var(--el-fill-color-light)"
            >
              <p class="font-medium mb-1" style="color: var(--foreground)">Chunk {{ i }}</p>
              <p style="color: var(--foreground); opacity: 0.6">文档片段内容将在加载后显示...</p>
            </div>
          </div>
        </el-card>
      </el-tab-pane>
    </el-tabs>

    <el-empty v-else description="文档不存在" />
  </div>
</template>
