<script setup lang="ts">
import { Delete, Edit, View } from '@element-plus/icons-vue'

defineProps<{
  id: string
  name: string
  description?: string
  documentCount?: number
  createdAt?: string
}>()

const emit = defineEmits<{
  view: [id: string]
  edit: [id: string]
  delete: [id: string]
}>()
</script>

<template>
  <el-card shadow="hover" class="cursor-pointer">
    <div class="flex items-start justify-between mb-2">
      <h3 class="font-semibold text-base" style="color: var(--foreground)">{{ name }}</h3>
      <div class="flex gap-1">
        <el-button :icon="View" size="small" text @click="emit('view', id)" />
        <el-button :icon="Edit" size="small" text @click="emit('edit', id)" />
        <el-button :icon="Delete" size="small" text @click="emit('delete', id)" />
      </div>
    </div>
    <p v-if="description" class="text-sm mb-3" style="color: var(--foreground); opacity: 0.6">{{ description }}</p>
    <div class="flex gap-4 text-xs" style="color: var(--foreground); opacity: 0.6">
      <span v-if="documentCount !== undefined">{{ documentCount }} 个文档</span>
      <span v-if="createdAt">{{ createdAt }}</span>
    </div>
  </el-card>
</template>
