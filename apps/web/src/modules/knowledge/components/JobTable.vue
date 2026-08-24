<script setup lang="ts">
import type { IndexJob } from '../types/job'
import { canCancelJob, canRetryJob, jobStatusLabel, jobStatusTagType, jobTypeLabel } from '../utils/job-display'
import { formatDate } from '@/utils/format'
import { CopyDocument, Refresh, VideoPause, View } from '@element-plus/icons-vue'

const props = defineProps<{
  jobs: IndexJob[]
  loading?: boolean
}>()

const emit = defineEmits<{
  cancel: [job: IndexJob]
  retry: [job: IndexJob]
  inspect: [job: IndexJob]
  copy: [id: string]
}>()
</script>

<template>
  <el-table
    v-loading="props.loading"
    :data="props.jobs"
    stripe
    row-key="id"
  >
    <el-table-column
      label="任务"
      min-width="280"
    >
      <template #default="{ row }">
        <div class="job-main">
          <div class="job-title">
            <span class="job-name">{{ row.documentName }}</span>
            <el-tag
              size="small"
              effect="plain"
            >
              {{ jobTypeLabel(row.type) }}
            </el-tag>
          </div>
          <div class="job-meta">
            {{ row.kbName }}<span v-if="row.versionNumber"> · v{{ row.versionNumber }}</span>
          </div>
          <div class="job-id">
            {{ row.id }}
          </div>
        </div>
      </template>
    </el-table-column>

    <el-table-column
      label="状态"
      width="110"
    >
      <template #default="{ row }">
        <el-tag
          :type="jobStatusTagType(row.status)"
          size="small"
          effect="light"
        >
          {{ jobStatusLabel(row.status) }}
        </el-tag>
      </template>
    </el-table-column>

    <el-table-column
      label="进度"
      min-width="220"
    >
      <template #default="{ row }">
        <slot
          name="progress"
          :job="row"
        />
      </template>
    </el-table-column>

    <el-table-column
      label="最近更新"
      width="150"
    >
      <template #default="{ row }">
        <span class="job-time">{{ formatDate(row.updatedAt, 'yyyy-mm-dd hh:mm:ss') }}</span>
      </template>
    </el-table-column>

    <el-table-column
      label="操作"
      width="210"
      fixed="right"
    >
      <template #default="{ row }">
        <div class="job-actions">
          <el-button
            text
            size="small"
            :icon="View"
            @click="emit('inspect', row as IndexJob)"
          >
            详情
          </el-button>
          <el-button
            text
            size="small"
            :icon="CopyDocument"
            @click="emit('copy', (row as IndexJob).id)"
          >
            复制 ID
          </el-button>
          <el-button
            v-if="canRetryJob(row as IndexJob)"
            size="small"
            type="primary"
            plain
            :icon="Refresh"
            @click="emit('retry', row as IndexJob)"
          >
            重试
          </el-button>
          <el-button
            v-if="canCancelJob(row as IndexJob)"
            size="small"
            type="danger"
            plain
            :icon="VideoPause"
            @click="emit('cancel', row as IndexJob)"
          >
            取消
          </el-button>
        </div>
      </template>
    </el-table-column>
  </el-table>
</template>

<style scoped>
.job-main {
  display: grid;
  gap: 4px;
  min-width: 0;
}
.job-title {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}
.job-name {
  color: var(--foreground);
  font-weight: 600;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.job-meta,
.job-id,
.job-time {
  color: var(--foreground);
  opacity: 0.58;
  font-size: 12px;
}
.job-id {
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.job-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}
</style>
