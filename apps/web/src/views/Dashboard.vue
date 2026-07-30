<template>
  <div>
    <h1 class="text-2xl font-semibold mb-6" style="color: var(--foreground)">平台概览</h1>

    <div class="grid grid-cols-3 gap-4 mb-8">
      <el-card v-for="stat in stats" :key="stat.label">
        <div class="text-center py-6">
          <div class="text-3xl font-bold" style="color: var(--foreground)">{{ stat.value }}</div>
          <div class="text-sm mt-1" style="color: var(--foreground); opacity: 0.6">{{ stat.label }}</div>
        </div>
      </el-card>
    </div>

    <el-card>
      <template #header>
        <h2 class="text-base font-semibold" style="color: var(--foreground)">最近对话</h2>
      </template>
      <p class="text-sm" style="color: var(--foreground); opacity: 0.6">暂无对话记录</p>
    </el-card>
  </div>
</template>

<script setup lang="ts">
const stats = [
  { label: '知识库', value: 3 },
  { label: '文档', value: 12 },
  { label: 'Chunks', value: 156 },
  { label: 'AI 应用', value: 5 },
  { label: '模型', value: 8 },
  { label: '工具', value: 2 },
]
</script>
