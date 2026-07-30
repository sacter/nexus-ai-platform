import { createRouter, createWebHistory } from 'vue-router'
import type { RouteRecordRaw } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

const routes: RouteRecordRaw[] = [
  // --- No-layout routes ---
  {
    path: '/login',
    name: 'Login',
    component: () => import('@/views/Login.vue'),
    meta: { guest: true },
  },
  {
    path: '/register',
    name: 'Register',
    component: () => import('@/views/Register.vue'),
    meta: { guest: true },
  },

  // --- Layout routes ---
  {
    path: '/',
    component: () => import('@/layouts/MainLayout.vue'),
    meta: { requiresAuth: true },
    children: [
      { path: '', name: 'Dashboard', component: () => import('@/views/Dashboard.vue') },
      { path: 'knowledge-bases', name: 'KnowledgeBases', component: () => import('@/views/KnowledgeBases.vue') },
      { path: 'knowledge-bases/:kbId', name: 'KnowledgeBaseDetail', component: () => import('@/views/KnowledgeBaseDetail.vue') },
      { path: 'knowledge-bases/documents', name: 'Documents', component: () => import('@/views/Documents.vue') },
      { path: 'knowledge-bases/documents/:id', name: 'DocumentDetail', component: () => import('@/views/DocumentDetail.vue') },
      { path: 'ai-applications', name: 'AiApplications', component: () => import('@/views/AiApplications.vue') },
      { path: 'ai-applications/:appId', name: 'AiApplicationDetail', component: () => import('@/views/AiApplicationDetail.vue') },
      { path: 'chat', name: 'Chat', component: () => import('@/views/Chat.vue') },
      { path: 'chat/:sessionId', name: 'ChatSession', component: () => import('@/views/ChatSession.vue') },
      { path: 'workflows', name: 'Workflows', component: () => import('@/views/Workflows.vue') },
      { path: 'workflows/:id', name: 'WorkflowDetail', component: () => import('@/views/WorkflowDetail.vue') },
      { path: 'workflows/designer', name: 'WorkflowDesigner', component: () => import('@/views/WorkflowDesigner.vue') },
      { path: 'models', name: 'Models', component: () => import('@/views/Models.vue') },
      { path: 'tools', name: 'Tools', component: () => import('@/views/Tools.vue') },
      { path: 'jobs', name: 'Jobs', component: () => import('@/views/Jobs.vue') },
      { path: 'settings', name: 'Settings', component: () => import('@/views/Settings.vue') },
      { path: 'settings/api-keys', name: 'ApiKeys', component: () => import('@/views/ApiKeys.vue') },
      { path: 'settings/prompts', name: 'Prompts', component: () => import('@/views/Prompts.vue') },
      { path: 'audit-logs', name: 'AuditLogs', component: () => import('@/views/AuditLogs.vue') },
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
