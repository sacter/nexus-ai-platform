<script setup lang="ts">
import { ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  Monitor,
  Collection,
  Cpu,
  ChatDotSquare,
  Share,
  Coin,
  Switch,
  Timer,
  Setting,
  Lock,
  Fold,
  Expand,
} from '@element-plus/icons-vue'

const navItems = [
  { href: '/', label: '仪表盘', icon: Monitor },
  { href: '/knowledge-bases', label: '知识库', icon: Collection },
  { href: '/ai-applications', label: 'AI 应用', icon: Cpu },
  { href: '/chat', label: '对话', icon: ChatDotSquare },
  { href: '/workflows', label: 'Workflow', icon: Share },
  { href: '/models', label: '模型', icon: Coin },
  { href: '/tools', label: '工具', icon: Switch },
  { href: '/jobs', label: 'Job', icon: Timer },
  { href: '/settings', label: '设置', icon: Setting },
  { href: '/audit-logs', label: '审计', icon: Lock },
]

const route = useRoute()
const router = useRouter()

function isActive(href: string): boolean {
  if (href === '/') return route.path === '/'
  return route.path.startsWith(href)
}

function navigate(href: string) {
  router.push(href)
}

// 侧边栏收起状态（localStorage 持久化）
const collapsed = ref(localStorage.getItem('nexus-sidebar-collapsed') === '1')

function toggleCollapsed() {
  collapsed.value = !collapsed.value
  localStorage.setItem('nexus-sidebar-collapsed', collapsed.value ? '1' : '0')
}
</script>

<template>
  <aside
    class="shrink-0 border-r h-dvh sticky top-0 overflow-y-auto flex flex-col transition-[width] duration-200 ease-out"
    :class="collapsed ? 'w-16' : 'w-56'"
    style="border-color: var(--border); background-color: var(--surface)"
  >
    <div
      class="flex items-center gap-2.5 h-14 shrink-0 transition-[padding] duration-200"
      :class="collapsed ? 'justify-center px-0' : 'justify-start px-4'"
      style="border-bottom: 1px solid var(--border)"
    >
      <div
        class="flex h-7 w-7 items-center justify-center rounded-lg shrink-0"
        style="background: var(--brand-gradient)"
      >
        <el-icon
          :size="15"
          color="#fff"
        >
          <Monitor />
        </el-icon>
      </div>
      <span
        class="font-display text-sm font-bold tracking-tight truncate overflow-hidden whitespace-nowrap transition-all duration-200"
        :class="collapsed ? 'opacity-0 w-0' : 'opacity-100'"
        style="background: var(--brand-gradient); -webkit-background-clip: text; background-clip: text; color: transparent"
      >Nexus AI</span>
    </div>
    <nav class="p-3 flex flex-col gap-1 flex-1">
      <el-tooltip
        v-for="item in navItems"
        :key="item.href"
        :content="item.label"
        placement="right"
        :disabled="!collapsed"
      >
        <button
          class="group relative flex items-center rounded-lg py-2 text-sm font-medium transition-all duration-200 text-left w-full cursor-pointer"
          :class="[
            collapsed ? 'justify-center px-0' : 'justify-start px-3 gap-3',
            isActive(item.href)
              ? 'bg-accent/10 text-accent'
              : 'text-foreground/60 hover:bg-surface-secondary hover:text-foreground',
          ]"
          @click="navigate(item.href)"
        >
          <span
            v-if="isActive(item.href)"
            class="absolute left-0 top-1/2 -translate-y-1/2 h-4 w-[3px] rounded-full"
            style="background: var(--accent)"
          />
          <el-icon
            :size="16"
            class="shrink-0 transition-transform duration-200 group-hover:scale-110"
          >
            <component :is="item.icon" />
          </el-icon>
          <span
            class="truncate overflow-hidden whitespace-nowrap transition-all duration-200"
            :class="collapsed ? 'opacity-0 w-0' : 'opacity-100'"
          >{{ item.label }}</span>
        </button>
      </el-tooltip>
    </nav>

    <!-- 收起 / 展开按钮 -->
    <div
      class="p-2 shrink-0"
      style="border-top: 1px solid var(--border)"
    >
      <button
        class="flex w-full items-center rounded-lg py-2 text-sm font-medium transition-all duration-200 cursor-pointer"
        :class="collapsed ? 'justify-center px-0' : 'justify-start px-3 gap-3'"
        style="color: var(--foreground)"
        :aria-label="collapsed ? '展开侧边栏' : '收起侧边栏'"
        @click="toggleCollapsed"
      >
        <el-icon
          :size="16"
          class="shrink-0"
        >
          <Expand v-if="collapsed" />
          <Fold v-else />
        </el-icon>
        <span
          class="truncate overflow-hidden whitespace-nowrap transition-all duration-200"
          :class="collapsed ? 'opacity-0 w-0' : 'opacity-100'"
        >收起</span>
      </button>
    </div>
  </aside>
</template>
