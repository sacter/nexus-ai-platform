<script setup lang="ts">
import { useRouter } from 'vue-router'
import { Plus, Share } from '@element-plus/icons-vue'
import { useWorkflows, useDeleteWorkflow } from '@/modules/workflow/composables/useWorkflow'
import WorkflowCard from '@/modules/workflow/components/WorkflowCard.vue'
const router = useRouter()
const { data: wfs, isLoading } = useWorkflows()
const deleteMutation = useDeleteWorkflow()
function handleEdit(id: string) { router.push(`/workflows/${id}`) }
function handleExecute(_id: string) { /* TODO */ }
function handleDelete(id: string) { deleteMutation.mutate(id) }
</script>
<template>
  <div>
    <div class="mb-6 flex items-center justify-between">
      <div class="flex items-center gap-3">
        <div
          class="flex h-10 w-10 items-center justify-center rounded-xl shrink-0"
          style="background: var(--brand-gradient); box-shadow: 0 8px 20px -8px color-mix(in oklch, var(--accent) 55%, transparent)"
        >
          <el-icon
            :size="18"
            color="#fff"
          >
            <Share />
          </el-icon>
        </div>
        <div>
          <h1
            class="font-display text-2xl font-bold tracking-tight"
            style="color: var(--foreground)"
          >
            Workflow
          </h1>
          <p
            class="mt-0.5 text-xs"
            style="color: var(--foreground); opacity: 0.55"
          >
            可视化编排多步骤自动化流程
          </p>
        </div>
      </div>
      <div class="flex gap-2">
        <el-button @click="router.push('/workflows/designer')">
          设计器
        </el-button>
        <el-button
          type="primary"
          :icon="Plus"
          @click="router.push('/workflows/new')"
        >
          创建工作流
        </el-button>
      </div>
    </div>
    <div
      v-if="isLoading"
      class="grid grid-cols-3 gap-[11.2px]"
    >
      <el-skeleton
        v-for="i in 6"
        :key="i"
        animated
      >
        <template #template>
          <el-skeleton-item
            variant="rect"
            style="height: 110px; border-radius: 12px"
          />
        </template>
      </el-skeleton>
    </div>
    <div
      v-else-if="wfs && Array.isArray(wfs) && wfs.length > 0"
      class="grid grid-cols-3 gap-[11.2px]"
    >
      <WorkflowCard
        v-for="wf in wfs"
        :id="(wf as any).id"
        :key="(wf as any).id"
        :name="(wf as any).name"
        @edit="handleEdit"
        @execute="handleExecute"
        @delete="handleDelete"
      />
    </div>
    <el-empty
      v-else
      description="暂无 Workflow"
    />
  </div>
</template>
