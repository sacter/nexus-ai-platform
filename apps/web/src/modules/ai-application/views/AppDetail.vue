<script setup lang="ts">
import { useRoute } from 'vue-router'
import { useAiApplication } from '@/modules/ai-application/composables/useAiApplications'

const route = useRoute()
const appId = route.params.appId as string
const { data: app, isLoading } = useAiApplication(appId)
</script>

<template>
  <div>
    <h1 class="text-2xl font-semibold mb-6" style="color: var(--foreground)">
      {{ isLoading ? '加载中...' : (app as Record<string,string>)?.name || '应用详情' }}
    </h1>

    <el-card v-if="app">
      <el-descriptions :column="2" border>
        <el-descriptions-item label="名称">{{ (app as Record<string,string>).name }}</el-descriptions-item>
        <el-descriptions-item label="状态">
          <el-tag :type="(app as Record<string,string>).status === 'active' ? 'success' : 'info'">
            {{ (app as Record<string,string>).status }}
          </el-tag>
        </el-descriptions-item>
        <el-descriptions-item label="描述" :span="2">
          {{ (app as Record<string,string>).description || '-' }}
        </el-descriptions-item>
      </el-descriptions>
    </el-card>

    <el-empty v-else-if="!isLoading" description="应用不存在" />
  </div>
</template>
