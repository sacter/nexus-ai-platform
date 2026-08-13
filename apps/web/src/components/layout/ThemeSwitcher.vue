<script setup lang="ts">
import { computed, ref } from 'vue'
import { useThemeStore } from '@/stores/theme'
import { Sunny, Moon, Brush, Check } from '@element-plus/icons-vue'

const themes = [
  { key: 'uber', label: 'Uber', dot: 'oklch(0 0 0)' },
  { key: 'coinbase', label: 'Coinbase', dot: 'oklch(52.82% 0.2628 262.87)' },
  { key: 'rabbit', label: 'Rabbit', dot: 'oklch(66.78% 0.2232 36.66)' },
] as const

const themeStore = useThemeStore()
// setup 阶段同步读取，避免 onMounted 前的占位闪变
const colorTheme = ref(localStorage.getItem('nexus-color-theme') || 'uber')

const activeTheme = computed(
  () => themes.find((t) => t.key === colorTheme.value) ?? themes[0],
)

function applyColorTheme(key: string) {
  colorTheme.value = key
  localStorage.setItem('nexus-color-theme', key)
  document.documentElement.setAttribute('data-theme', key)
}
</script>

<template>
  <div class="flex items-center">
    <!-- Color theme selector -->
    <el-dropdown
      trigger="click"
      @command="applyColorTheme"
    >
      <el-button
        circle
        :icon="Brush"
        link
        class="relative"
        aria-label="配色主题"
      >
        <!-- 当前配色主题指示点 -->
        <span
          class="absolute right-0 bottom-1 h-2 w-2 rounded-full ring-2 ring-[var(--surface)]"
          :style="{ backgroundColor: activeTheme.dot }"
        />
      </el-button>
      <template #dropdown>
        <el-dropdown-menu>
          <el-dropdown-item
            v-for="t in themes"
            :key="t.key"
            :command="t.key"
            :class="{ 'is-active': colorTheme === t.key }"
          >
            <span
              class="mr-2 inline-block h-2 w-2 rounded-full"
              :style="{ backgroundColor: t.dot }"
            />
            {{ t.label }}
            <el-icon
              v-if="colorTheme === t.key"
              class="ml-2"
              :size="14"
            >
              <Check />
            </el-icon>
          </el-dropdown-item>
        </el-dropdown-menu>
      </template>
    </el-dropdown>

    <!-- Dark / Light toggle -->
    <el-button
      circle
      link
      aria-label="切换明暗主题"
      class="ml-0.5"
      @click="themeStore.toggle()"
    >
      <transition
        name="icon-swap"
        mode="out-in"
      >
        <el-icon
          :key="themeStore.theme"
          :size="16"
        >
          <Sunny v-if="themeStore.theme === 'light'" />
          <Moon v-else />
        </el-icon>
      </transition>
    </el-button>
  </div>
</template>
