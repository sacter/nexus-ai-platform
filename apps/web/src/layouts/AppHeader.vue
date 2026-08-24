<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Edit, SwitchButton, UserFilled } from '@element-plus/icons-vue'
import { useAuthStore } from '@/stores/auth'
import { useBreadcrumbStore } from '@/stores/breadcrumb'
import ThemeSwitcher from './ThemeSwitcher.vue'

const ROUTE_LABELS: Record<string, string> = {
  'knowledge-bases': '知识库',
  'ai-applications': 'AI 应用',
  chat: '对话',
  workflows: 'Workflow',
  models: '模型',
  tools: '工具',
  jobs: 'Job',
  settings: '设置',
  'audit-logs': '审计',
  login: '登录',
  register: '注册',
  'api-keys': 'API Keys',
  prompts: '提示词',
  documents: '文档',
  designer: '设计器',
  new: '新建',
  edit: '编辑',
}

const HIDDEN_BREADCRUMBS = new Set(['/login', '/register'])

function isDynamicId(segment: string): boolean {
  return (
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      segment,
    ) || /^\d+$/.test(segment)
  )
}

function buildBreadcrumbs(pathname: string, segmentLabels?: Record<string, string>) {
  const segments = pathname.split('/').filter(Boolean)
  if (segments.length === 0) return [{ href: '/', label: '仪表盘' }]

  const items: { href: string; label: string }[] = []
  let currentPath = ''

  for (const segment of segments) {
    currentPath += `/${segment}`
    const label =
      segmentLabels?.[segment] ??
      (isDynamicId(segment) ? '详情' : (ROUTE_LABELS[segment] ?? segment))
    items.push({ href: currentPath, label })
  }

  return items
}

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()
const breadcrumbStore = useBreadcrumbStore()

const breadcrumbs = computed(() =>
  buildBreadcrumbs(route.path, breadcrumbStore.segmentLabels),
)
const showBreadcrumbs = computed(() => !HIDDEN_BREADCRUMBS.has(route.path))

async function handleLogout() {
  await auth.logout()
  router.push('/login')
}
</script>

<template>
  <header
    class="h-14 shrink-0 flex items-center justify-between px-6 backdrop-blur-md"
    style="border-bottom: 1px solid var(--border); background-color: color-mix(in oklch, var(--surface) 82%, transparent)"
  >
    <div class="flex items-center gap-4">
      <el-breadcrumb
        v-if="showBreadcrumbs"
        separator="/"
      >
        <el-breadcrumb-item
          v-for="(item, index) in breadcrumbs"
          :key="item.href"
          :to="index < breadcrumbs.length - 1 ? item.href : undefined"
        >
          {{ item.label }}
        </el-breadcrumb-item>
      </el-breadcrumb>
    </div>

    <div class="flex items-center gap-2">
      <ThemeSwitcher />

      <template v-if="auth.isLoading">
        <div
          class="h-5 w-20 rounded animate-pulse"
          style="background-color: var(--surface-secondary)"
        />
      </template>
      <template v-else-if="auth.isAuthenticated && auth.user">
        <el-dropdown
          trigger="click"
          @command="(cmd: string) => {
            if (cmd === 'logout') handleLogout()
          }"
        >
          <span
            class="flex items-center gap-1.5 text-sm cursor-pointer outline-none"
            style="color: var(--foreground)"
          >
            <el-icon :size="16">
              <UserFilled />
            </el-icon>
            <span class="font-medium">{{ auth.user.username }}</span>
          </span>
          <template #dropdown>
            <el-dropdown-menu>
              <el-dropdown-item command="edit">
                <el-icon :size="14">
                  <Edit />
                </el-icon>
                <span>编辑信息</span>
              </el-dropdown-item>
              <el-dropdown-item
                command="logout"
                divided
              >
                <el-icon :size="14">
                  <SwitchButton />
                </el-icon>
                <span style="color: var(--el-color-danger)">退出登录</span>
              </el-dropdown-item>
            </el-dropdown-menu>
          </template>
        </el-dropdown>
      </template>
      <template v-else>
        <router-link
          to="/login"
          class="flex items-center gap-2 text-sm transition-colors"
          style="color: var(--foreground)"
        >
          <el-icon :size="20">
            <UserFilled />
          </el-icon>
          <span>登录</span>
        </router-link>
      </template>
    </div>
  </header>
</template>
