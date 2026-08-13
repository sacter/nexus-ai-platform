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
  <el-card
    shadow="hover"
    class="group"
  >
    <div class="flex items-start justify-between gap-2 mb-2">
      <div class="min-w-0">
        <h3
          class="font-semibold text-base truncate"
          style="color: var(--foreground)"
        >
          {{ name }}
        </h3>
        <el-tag
          v-if="status"
          size="small"
          class="mt-1"
        >
          {{ status }}
        </el-tag>
      </div>
      <div class="flex gap-1 shrink-0">
        <el-tooltip content="查看">
          <el-button
            :icon="View"
            size="small"
            text
            aria-label="查看"
            @click="emit('view', id)"
          />
        </el-tooltip>
        <el-tooltip content="编辑">
          <el-button
            :icon="Edit"
            size="small"
            text
            aria-label="编辑"
            @click="emit('edit', id)"
          />
        </el-tooltip>
        <el-tooltip content="删除">
          <el-button
            :icon="Delete"
            size="small"
            text
            aria-label="删除"
            @click="emit('delete', id)"
          />
        </el-tooltip>
      </div>
    </div>
    <p
      v-if="description"
      class="text-sm line-clamp-2"
      style="color: var(--foreground); opacity: 0.6"
    >
      {{ description }}
    </p>
  </el-card>
</template>
