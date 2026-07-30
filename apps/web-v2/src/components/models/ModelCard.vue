<script setup lang="ts">
import { Delete, Edit } from '@element-plus/icons-vue'
defineProps<{ id: string; name: string; provider?: string; type?: string }>()
const emit = defineEmits<{ edit: [id: string]; delete: [id: string] }>()
</script>
<template>
  <el-card shadow="hover">
    <div class="flex items-start justify-between mb-2">
      <h3 class="font-semibold text-base" style="color: var(--foreground)">{{ name }}</h3>
      <div class="flex gap-1">
        <el-button :icon="Edit" size="small" text @click="emit('edit', id)" />
        <el-button :icon="Delete" size="small" text @click="emit('delete', id)" />
      </div>
    </div>
    <div class="flex gap-2">
      <el-tag v-if="provider" size="small">{{ provider }}</el-tag>
      <el-tag v-if="type" size="small" type="info">{{ type }}</el-tag>
    </div>
  </el-card>
</template>
