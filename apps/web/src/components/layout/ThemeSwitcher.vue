<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useThemeStore } from '@/stores/theme'
import { Sunny, Moon, Brush, Check } from '@element-plus/icons-vue'

const themes = [
  { key: 'uber', label: 'Uber' },
  { key: 'coinbase', label: 'Coinbase' },
  { key: 'rabbit', label: 'Rabbit' },
] as const

const themeStore = useThemeStore()
const colorTheme = ref('uber')
const mounted = ref(false)

function applyColorTheme(key: string) {
  colorTheme.value = key
  localStorage.setItem('nexus-color-theme', key)
  document.documentElement.setAttribute('data-theme', key)
}

onMounted(() => {
  colorTheme.value = localStorage.getItem('nexus-color-theme') || 'uber'
  mounted.value = true
})
</script>

<template>
  <!-- Show placeholder while not mounted to prevent layout shift -->
  <div v-if="!mounted" class="flex items-center gap-1">
    <el-button disabled circle :icon="Brush" />
    <el-button disabled circle :icon="Sunny" />
  </div>

  <div v-else class="flex items-center gap-1">
    <!-- Color theme selector -->
    <el-dropdown trigger="click" @command="applyColorTheme">
      <el-button circle :icon="Brush" aria-label="配色主题" />
      <template #dropdown>
        <el-dropdown-menu>
          <el-dropdown-item
            v-for="t in themes"
            :key="t.key"
            :command="t.key"
            :class="{ 'is-active': colorTheme === t.key }"
          >
            {{ t.label }}
            <el-icon v-if="colorTheme === t.key" class="ml-2" :size="14"><Check /></el-icon>
          </el-dropdown-item>
        </el-dropdown-menu>
      </template>
    </el-dropdown>

    <!-- Dark / Light toggle -->
    <el-button circle @click="themeStore.toggle()">
      <el-icon :size="16">
        <Sunny v-if="themeStore.theme === 'light'" />
        <Moon v-else />
      </el-icon>
    </el-button>
  </div>
</template>
