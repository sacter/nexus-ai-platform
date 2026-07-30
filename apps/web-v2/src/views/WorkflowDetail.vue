<script setup lang="ts">
import { useRoute } from 'vue-router'
import { useWorkflow } from '@/composables/use-workflows'
const route = useRoute()
const wfId = route.params.id as string
const { data: wf, isLoading } = useWorkflow(wfId)
</script>
<template>
  <div>
    <h1 class="text-2xl font-semibold mb-6" style="color: var(--foreground)">{{ isLoading ? '加载中...' : (wf as any)?.name || 'Workflow 详情' }}</h1>
    <el-card v-if="wf">
      <el-descriptions :column="2" border>
        <el-descriptions-item label="名称">{{ (wf as any).name }}</el-descriptions-item>
        <el-descriptions-item label="状态"><el-tag>{{ (wf as any).status || 'draft' }}</el-tag></el-descriptions-item>
        <el-descriptions-item label="描述" :span="2">{{ (wf as any).description || '-' }}</el-descriptions-item>
      </el-descriptions>
    </el-card>
    <el-empty v-else-if="!isLoading" description="Workflow 不存在" />
  </div>
</template>
