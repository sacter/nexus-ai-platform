import { createRouter, createWebHistory } from 'vue-router'
import type { RouteRecordRaw } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

const routes: RouteRecordRaw[] = [
  // --- No-layout routes ---
  {
    path: '/login',
    name: 'Login',
    component: () => import('@/modules/system/auth/views/Login.vue'),
    meta: { guest: true },
  },
  {
    path: '/register',
    name: 'Register',
    component: () => import('@/modules/system/auth/views/Register.vue'),
    meta: { guest: true },
  },

  // --- Layout routes ---
  {
    path: '/',
    component: () => import('@/layouts/MainLayout.vue'),
    meta: { requiresAuth: true },
    children: [
      // Dashboard
      { path: '', name: 'Dashboard', component: () => import('@/modules/dashboard/views/Dashboard.vue') },

      // Knowledge
      { path: 'knowledge-bases', name: 'KnowledgeBases', component: () => import('@/modules/knowledge/views/KnowledgeList.vue') },
      { path: 'knowledge-bases/:kbId', name: 'KnowledgeBaseDetail', component: () => import('@/modules/knowledge/views/KnowledgeDetail.vue') },
      { path: 'knowledge-bases/documents', name: 'Documents', component: () => import('@/modules/knowledge/views/DocumentList.vue') },
      { path: 'knowledge-bases/documents/:id', name: 'DocumentDetail', component: () => import('@/modules/knowledge/views/DocumentDetail.vue') },
      { path: 'jobs', name: 'Jobs', component: () => import('@/modules/knowledge/views/JobList.vue') },

      // AI Applications
      { path: 'ai-applications', name: 'AiApplications', component: () => import('@/modules/ai-application/views/AppList.vue') },
      { path: 'ai-applications/new', name: 'AiApplicationCreate', component: () => import('@/modules/ai-application/views/AppForm.vue') },
      { path: 'ai-applications/:appId', name: 'AiApplicationDetail', component: () => import('@/modules/ai-application/views/AppDetail.vue') },
      { path: 'ai-applications/:appId/edit', name: 'AiApplicationEdit', component: () => import('@/modules/ai-application/views/AppForm.vue') },

      // Chat
      { path: 'chat', name: 'Chat', component: () => import('@/modules/chat/views/ChatList.vue') },
      { path: 'chat/new', redirect: '/chat' },
      { path: 'chat/:sessionId', name: 'ChatSession', component: () => import('@/modules/chat/views/ChatSession.vue') },

      // Workflow
      { path: 'workflows', name: 'Workflows', component: () => import('@/modules/workflow/views/WorkflowList.vue') },
      { path: 'workflows/:id', name: 'WorkflowDetail', component: () => import('@/modules/workflow/views/WorkflowDetail.vue') },
      { path: 'workflows/designer', name: 'WorkflowDesigner', component: () => import('@/modules/workflow/views/WorkflowDesigner.vue') },

      // Models
      { path: 'models', name: 'Models', component: () => import('@/modules/models/views/ModelList.vue') },

      // Tools
      { path: 'tools', name: 'Tools', component: () => import('@/modules/tools/views/ToolList.vue') },

      // Prompt
      { path: 'settings/prompts', name: 'Prompts', component: () => import('@/modules/prompt/views/PromptList.vue') },

      // System
      { path: 'settings', name: 'Settings', component: () => import('@/modules/system/views/Settings.vue') },
      { path: 'api-keys', name: 'ApiKeys', component: () => import('@/modules/api-keys/views/ApiKeys.vue') },
      { path: 'audit-logs', name: 'AuditLogs', component: () => import('@/modules/system/views/AuditLogs.vue') },
    ],
  },
]

const router = createRouter({
  history: createWebHistory(),
  routes,
})

router.beforeEach(async (to, _from, next) => {
  const auth = useAuthStore()

  if (!auth.initialized) {
    await auth.refreshUser()
  }

  if (to.meta.requiresAuth && !auth.isAuthenticated) {
    next({ name: 'Login', query: { redirect: to.fullPath } })
  } else if (to.meta.guest && auth.isAuthenticated) {
    next({ name: 'Dashboard' })
  } else {
    next()
  }
})

export default router
