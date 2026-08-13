<template>
  <div>
    <div class="flex items-center justify-between mb-6">
      <h1
        class="text-2xl font-semibold tracking-tight"
        style="color: var(--foreground)"
      >
        平台概览
      </h1>
      <span
        class="num text-xs px-2.5 py-1 rounded-full"
        style="background: var(--accent-soft); color: var(--accent)"
      >NEXUS AI PLATFORM</span>
    </div>

    <div class="grid grid-cols-3 gap-[11.2px] mb-4">
      <el-card
        v-for="(stat, i) in stats"
        :key="stat.label"
        shadow="hover"
        class="rise-in"
        :style="{ animationDelay: `${i * 60}ms` }"
      >
        <div class="flex items-center gap-4 py-1">
          <div
            class="h-11 w-11 rounded-xl flex items-center justify-center shrink-0"
            style="background: var(--accent-soft); color: var(--accent)"
          >
            <el-icon :size="20">
              <component :is="stat.icon" />
            </el-icon>
          </div>
          <div class="min-w-0">
            <div
              class="num text-2xl font-bold leading-none"
              style="color: var(--foreground)"
            >
              {{ stat.value }}
            </div>
            <div
              class="text-sm mt-1.5"
              style="color: var(--foreground); opacity: 0.6"
            >
              {{ stat.label }}
            </div>
          </div>
        </div>
      </el-card>
    </div>

    <el-card>
      <template #header>
        <h2
          class="text-base font-semibold"
          style="color: var(--foreground)"
        >
          最近对话
        </h2>
      </template>
      <el-empty description="暂无对话记录">
        <el-button
          type="primary"
          @click="router.push('/chat')"
        >
          开始新对话
        </el-button>
      </el-empty>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { useRouter } from 'vue-router'
import { Collection, Document, Grid, Cpu, Coin, Switch } from '@element-plus/icons-vue'

const router = useRouter()

const stats = [
  { label: '知识库', value: 3, icon: Collection },
  { label: '文档', value: 12, icon: Document },
  { label: 'Chunks', value: 156, icon: Grid },
  { label: 'AI 应用', value: 5, icon: Cpu },
  { label: '模型', value: 8, icon: Coin },
  { label: '工具', value: 2, icon: Switch },
]
</script>
