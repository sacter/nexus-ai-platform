<script setup lang="ts">
import { Delete, Edit } from '@element-plus/icons-vue'
defineProps<{ id: string; name: string; description?: string; type?: string }>()
const emit = defineEmits<{ edit: [id: string]; delete: [id: string] }>()
</script>
<template>
  <el-card
    shadow="hover"
    class="group"
  >
    <div class="flex items-start justify-between gap-2 mb-2">
      <h3
        class="font-semibold text-base truncate min-w-0"
        style="color: var(--foreground)"
      >
        {{ name }}
      </h3>
      <div class="flex gap-1 shrink-0">
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
    <el-tag
      v-if="type"
      size="small"
      class="mt-2"
    >
      {{ type }}
    </el-tag>
  </el-card>
</template>
