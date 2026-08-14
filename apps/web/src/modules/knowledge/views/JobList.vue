<script setup lang="ts">
import { Timer } from '@element-plus/icons-vue'
import { useJobs, useCancelJob } from '@/modules/knowledge/composables/useJobs'
import JobTable from '@/modules/knowledge/components/JobTable.vue'
const { data: jobs, isLoading } = useJobs()
const cancelMutation = useCancelJob()
function handleCancel(id: string) { cancelMutation.mutate(id) }
</script>
<template>
  <div>
    <div class="mb-6 flex items-center gap-3">
      <div
        class="flex h-10 w-10 items-center justify-center rounded-xl shrink-0"
        style="background: var(--brand-gradient); box-shadow: 0 8px 20px -8px color-mix(in oklch, var(--accent) 55%, transparent)"
      >
        <el-icon
          :size="18"
          color="#fff"
        >
          <Timer />
        </el-icon>
      </div>
      <div>
        <h1
          class="font-display text-2xl font-bold tracking-tight"
          style="color: var(--foreground)"
        >
          Job
        </h1>
        <p
          class="mt-0.5 text-xs"
          style="color: var(--foreground); opacity: 0.55"
        >
          查看文档处理任务及执行状态
        </p>
      </div>
    </div>
    <JobTable
      :jobs="(jobs as unknown[]) || []"
      :loading="isLoading"
      @cancel="handleCancel"
    />
  </div>
</template>
