<script setup lang="ts">
defineProps<{ jobs: unknown[]; loading?: boolean }>()
const emit = defineEmits<{ cancel: [id: string]; retry: [id: string] }>()
</script>
<template>
  <el-table
    v-loading="loading"
    :data="jobs"
    stripe
  >
    <el-table-column
      prop="id"
      label="Job ID"
      width="240"
    />
    <el-table-column
      prop="type"
      label="类型"
      width="120"
    />
    <el-table-column
      prop="status"
      label="状态"
      width="120"
    >
      <template #default="{ row }">
        <el-tag
          :type="(row as any).status === 'completed' ? 'success' : (row as any).status === 'failed' ? 'danger' : 'warning'"
          size="small"
        >
          {{ (row as any).status }}
        </el-tag>
      </template>
    </el-table-column>
    <el-table-column
      prop="progress"
      label="进度"
      min-width="150"
    >
      <template #default="{ row }">
        <el-progress
          :percentage="(row as any).progress || 0"
          :status="(row as any).status === 'failed' ? 'exception' : undefined"
        />
      </template>
    </el-table-column>
    <el-table-column
      prop="createdAt"
      label="创建时间"
      width="160"
    />
    <el-table-column
      label="操作"
      width="160"
      fixed="right"
    >
      <template #default="{ row }">
        <el-button
          v-if="(row as any).status === 'failed'"
          size="small"
          @click="emit('retry', (row as any).id)"
        >
          重试
        </el-button>
        <el-button
          v-if="(row as any).status === 'running' || (row as any).status === 'pending'"
          size="small"
          type="danger"
          @click="emit('cancel', (row as any).id)"
        >
          取消
        </el-button>
      </template>
    </el-table-column>
  </el-table>
</template>
