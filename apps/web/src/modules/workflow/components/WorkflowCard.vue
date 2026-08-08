<script setup lang="ts">
import { Delete, Edit, VideoPlay } from '@element-plus/icons-vue'
defineProps<{ id: string; name: string; description?: string; status?: string }>()
const emit = defineEmits<{ view: [id: string]; edit: [id: string]; delete: [id: string]; execute: [id: string] }>()
</script>
<template>
  <el-card shadow="hover">
    <div class="flex items-start justify-between mb-2">
      <h3
        class="font-semibold text-base"
        style="color: var(--foreground)"
      >
        {{ name }}
      </h3>
      <div class="flex gap-1">
        <el-button
          :icon="VideoPlay"
          size="small"
          text
          @click="emit('execute', id)"
        />
        <el-button
          :icon="Edit"
          size="small"
          text
          @click="emit('edit', id)"
        />
        <el-button
          :icon="Delete"
          size="small"
          text
          @click="emit('delete', id)"
        />
      </div>
    </div>
    <p
      v-if="description"
      class="text-sm"
      style="color: var(--foreground); opacity: 0.6"
    >
      {{ description }}
    </p>
    <el-tag
      v-if="status"
      size="small"
      class="mt-2"
    >
      {{ status }}
    </el-tag>
  </el-card>
</template>
