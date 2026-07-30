<script setup lang="ts">
defineProps<{ executions?: unknown[]; loading?: boolean }>()
</script>
<template>
  <el-table :data="executions || []" v-loading="loading" stripe>
    <el-table-column prop="id" label="执行 ID" width="200" />
    <el-table-column prop="status" label="状态" width="120">
      <template #default="{ row }"><el-tag :type="(row as any).status === 'completed' ? 'success' : 'warning'" size="small">{{ (row as any).status }}</el-tag></template>
    </el-table-column>
    <el-table-column prop="startedAt" label="开始时间" width="160" />
  </el-table>
</template>
