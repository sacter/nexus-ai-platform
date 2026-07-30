<script setup lang="ts">
import { computed } from 'vue'
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
</script>

<template>
  <aside
    class="w-56 shrink-0 border-r h-screen sticky top-0 overflow-y-auto"
    style="border-color: var(--border); background-color: var(--surface)"
  >
    <div
      class="flex items-center gap-2 h-14 px-4"
      style="border-bottom: 1px solid var(--border)"
    >
      <el-icon :size="20" color="var(--accent)">
        <Monitor />
      </el-icon>
      <span class="font-semibold text-sm" style="color: var(--foreground)">Nexus AI</span>
    </div>
    <nav class="p-3 flex flex-col gap-0.5">
      <button
        v-for="item in navItems"
        :key="item.href"
        class="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors text-left w-full cursor-pointer"
        :class="
          isActive(item.href)
            ? 'bg-accent/10 text-accent'
            : 'text-foreground/60 hover:bg-surface-secondary hover:text-foreground'
        "
        @click="navigate(item.href)"
      >
        <el-icon :size="16">
          <component :is="item.icon" />
        </el-icon>
        {{ item.label }}
      </button>
    </nav>
  </aside>
</template>
