<script setup lang="ts">
import { useJobs, useCancelJob } from '@/modules/knowledge/composables/useJobs'
import JobTable from '@/modules/knowledge/components/JobTable.vue'
const { data: jobs, isLoading } = useJobs()
const cancelMutation = useCancelJob()
function handleCancel(id: string) { cancelMutation.mutate(id) }
</script>
<template>
  <div>
    <h1
      class="text-2xl font-semibold mb-6"
      style="color: var(--foreground)"
    >
      Job
    </h1>
    <JobTable
      :jobs="(jobs as unknown[]) || []"
      :loading="isLoading"
      @cancel="handleCancel"
    />
  </div>
</template>
