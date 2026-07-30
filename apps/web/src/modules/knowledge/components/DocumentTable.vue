<script setup lang="ts">
import { Delete, Download } from '@element-plus/icons-vue'

defineProps<{
  documents: unknown[]
  loading?: boolean
}>()

const emit = defineEmits<{
  view: [id: string]
  delete: [id: string]
}>()
</script>

<template>
  <el-table :data="documents" v-loading="loading" stripe>
    <el-table-column prop="name" label="文档名称" min-width="200" />
    <el-table-column prop="type" label="类型" width="100" />
    <el-table-column prop="size" label="大小" width="100" />
    <el-table-column prop="status" label="状态" width="120">
      <template #default="{ row }">
        <el-tag :type="(row as Record<string,string>).status === 'completed' ? 'success' : 'warning'" size="small">
          {{ (row as Record<string,string>).status }}
        </el-tag>
      </template>
    </el-table-column>
    <el-table-column prop="createdAt" label="创建时间" width="160" />
    <el-table-column label="操作" width="160" fixed="right">
      <template #default="{ row }">
        <el-button :icon="Download" size="small" text @click="emit('view', (row as Record<string,string>).id)" />
        <el-button :icon="Delete" size="small" text @click="emit('delete', (row as Record<string,string>).id)" />
      </template>
    </el-table-column>
  </el-table>
</template>
