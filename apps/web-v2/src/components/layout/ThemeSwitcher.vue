<script setup lang="ts">
import { useThemeStore } from '@/stores/theme'
import { Sunny, Moon } from '@element-plus/icons-vue'

const themeStore = useThemeStore()
</script>

<template>
  <button
    class="flex items-center justify-center w-8 h-8 rounded-lg transition-colors"
    style="background-color: transparent"
    @click="themeStore.toggle()"
  >
    <el-icon :size="16">
      <Sunny v-if="themeStore.theme === 'light'" />
      <Moon v-else />
    </el-icon>
  </button>
</template>
