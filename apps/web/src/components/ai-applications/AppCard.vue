<script setup lang="ts">
import { Delete, Edit, View } from '@element-plus/icons-vue'

defineProps<{
  id: string
  name: string
  description?: string
  status?: string
}>()

const emit = defineEmits<{
  view: [id: string]
  edit: [id: string]
  delete: [id: string]
}>()
</script>

<template>
  <el-card shadow="hover">
    <div class="flex items-start justify-between mb-2">
      <div>
        <h3 class="font-semibold text-base" style="color: var(--foreground)">{{ name }}</h3>
        <el-tag v-if="status" size="small" class="mt-1">{{ status }}</el-tag>
      </div>
      <div class="flex gap-1">
        <el-button :icon="View" size="small" text @click="emit('view', id)" />
        <el-button :icon="Edit" size="small" text @click="emit('edit', id)" />
        <el-button :icon="Delete" size="small" text @click="emit('delete', id)" />
      </div>
    </div>
    <p v-if="description" class="text-sm" style="color: var(--foreground); opacity: 0.6">{{ description }}</p>
  </el-card>
</template>
