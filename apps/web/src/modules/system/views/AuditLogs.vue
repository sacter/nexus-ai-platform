<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import dayjs from 'dayjs'
import { ElMessage } from 'element-plus'
import {
  CopyDocument,
  Lock,
  Refresh,
  Search,
  View,
} from '@element-plus/icons-vue'
import { knowledgeBasesApi } from '@/modules/knowledge/api/knowledge.api'
import { useAuditLogs } from '@/modules/system/composables/useAuditLogs'
import {
  ACTION_OPTIONS,
  ENTITY_TYPE_OPTIONS,
  auditActionLabel,
  auditActionTagType,
  entityTypeLabel,
  formatAuditDetails,
} from '@/modules/system/utils/audit-log-display'
import type { AuditLog, AuditLogListParams } from '@/modules/system/types/audit-log'

const keyword = ref('')
const user = ref('')
const action = ref('')
const entityType = ref('')
const kbId = ref('')
const dateRange = ref<[string, string] | null>(null)
const page = ref(1)
const pageSize = ref(20)
const selectedLog = ref<AuditLog | null>(null)
const drawerVisible = ref(false)
const knowledgeBases = ref<Array<{ id: string; name: string }>>([])

const queryParams = computed<AuditLogListParams>(() => {
  const params: AuditLogListParams = { page: page.value, pageSize: pageSize.value }
  const assign = (key: keyof AuditLogListParams, value: string | undefined) => {
    if (value?.trim()) params[key] = value.trim() as never
  }
  assign('keyword', keyword.value)
  assign('user', user.value)
  assign('action', action.value)
  assign('entityType', entityType.value)
  assign('kbId', kbId.value)
  if (dateRange.value?.[0]) params.startDate = dayjs(dateRange.value[0]).format('YYYY-MM-DDT00:00:00.000[Z]')
  if (dateRange.value?.[1]) params.endDate = dayjs(dateRange.value[1]).format('YYYY-MM-DDT23:59:59.999[Z]')
  return params
})

const { data, isLoading, isFetching, isError, refetch } = useAuditLogs(queryParams)
const logs = computed(() => data.value?.items ?? [])
const total = computed(() => data.value?.total ?? 0)
const hasFilters = computed(() => Boolean(keyword.value || user.value || action.value || entityType.value || kbId.value || dateRange.value?.length))
const latestActivity = computed(() => logs.value[0]?.createdAt ? formatTime(logs.value[0].createdAt) : '--')

function formatTime(value: string | null | undefined) {
  return value ? dayjs(value).format('YYYY-MM-DD HH:mm:ss') : '--'
}

function resetPage() {
  page.value = 1
}

function resetFilters() {
  keyword.value = ''
  user.value = ''
  action.value = ''
  entityType.value = ''
  kbId.value = ''
  dateRange.value = null
  resetPage()
}

function openDetail(log: AuditLog) {
  selectedLog.value = log
  drawerVisible.value = true
}

async function copyValue(value: string | null | undefined, label: string) {
  if (!value || value === '--') return
  try {
    await navigator.clipboard.writeText(value)
    ElMessage.success(`${label}已复制`)
  } catch {
    ElMessage.error('复制失败，请手动复制')
  }
}

async function loadKnowledgeBases() {
  try {
    const response = await knowledgeBasesApi.list()
    const items = Array.isArray(response) ? response : (response as { items?: unknown[] }).items ?? []
    knowledgeBases.value = items
      .map((item: any) => ({ id: String(item.id ?? item.kbId ?? ''), name: String(item.name ?? item.kbName ?? '') }))
      .filter((item) => item.id && item.name)
  } catch {
    knowledgeBases.value = []
  }
}

watch([keyword, user, action, entityType, kbId, dateRange], resetPage)
onMounted(loadKnowledgeBases)
</script>

<template>
  <main class="audit-page">
    <header class="audit-header">
      <div class="audit-title-wrap">
        <div class="audit-mark"><el-icon :size="18" color="#fff"><Lock /></el-icon></div>
        <div>
          <h1 class="audit-title">审计日志</h1>
          <p class="audit-subtitle">查看平台关键操作审计记录</p>
        </div>
      </div>
      <el-button
        :loading="isFetching"
        :icon="Refresh"
        aria-label="刷新审计日志"
        circle
        @click="refetch"
      />
    </header>

    <section class="audit-stats" aria-label="审计日志概览">
      <div class="stat-card"><span class="stat-label">记录总数</span><strong>{{ total }}</strong><span class="stat-hint">全部审计事件</span></div>
      <div class="stat-card"><span class="stat-label">本页记录</span><strong>{{ logs.length }}</strong><span class="stat-hint">当前筛选结果</span></div>
      <div class="stat-card"><span class="stat-label">最近活动</span><strong class="stat-time">{{ latestActivity }}</strong><span class="stat-hint">最新事件时间</span></div>
    </section>

    <section class="filter-panel" aria-label="筛选审计日志">
      <div class="filter-row">
        <div data-test="keyword-filter">
          <el-input v-model="keyword" placeholder="搜索用户、资源或日志 ID" clearable :prefix-icon="Search" />
        </div>
        <el-input v-model="user" placeholder="用户 ID" clearable />
        <el-select v-model="action" placeholder="操作类型" clearable>
          <el-option v-for="item in ACTION_OPTIONS" :key="item.value" v-bind="item" />
        </el-select>
        <el-select v-model="entityType" placeholder="资源类型" clearable>
          <el-option v-for="item in ENTITY_TYPE_OPTIONS" :key="item.value" v-bind="item" />
        </el-select>
        <el-select v-model="kbId" placeholder="知识库" clearable>
          <el-option v-for="item in knowledgeBases" :key="item.id" :label="item.name" :value="item.id" />
        </el-select>
        <el-date-picker v-model="dateRange" type="daterange" value-format="YYYY-MM-DD" start-placeholder="开始日期" end-placeholder="结束日期" />
        <el-button v-if="hasFilters" data-test="reset-filters" @click="resetFilters">清空筛选</el-button>
      </div>
    </section>

    <el-alert v-if="isError" class="audit-error" title="审计日志加载失败" description="请检查网络连接后重试。" type="error" show-icon>
      <template #default><el-button data-test="retry-load" size="small" type="danger" plain @click="refetch">重试加载</el-button></template>
    </el-alert>

    <section class="table-panel">
      <el-skeleton v-if="isLoading" :rows="6" animated />
      <template v-else-if="logs.length">
        <el-table :data="logs" class="audit-table" stripe>
          <el-table-column label="时间" min-width="178">
            <template #default="{ row }"><span class="event-time">{{ formatTime(row.createdAt) }}</span></template>
          </el-table-column>
          <el-table-column label="操作" min-width="145">
            <template #default="{ row }"><el-tag :type="auditActionTagType(row.action)" effect="light">{{ auditActionLabel(row.action) }}</el-tag></template>
          </el-table-column>
          <el-table-column label="用户" prop="username" min-width="125">
            <template #default="{ row }">{{ row.username || row.userId || '--' }}</template>
          </el-table-column>
          <el-table-column label="资源" min-width="150">
            <template #default="{ row }">{{ entityTypeLabel(row.entityType) }}<span class="muted-id">{{ row.entityId || '--' }}</span></template>
          </el-table-column>
          <el-table-column label="知识库" prop="kbName" min-width="130"><template #default="{ row }">{{ row.kbName || row.kbId || '--' }}</template></el-table-column>
          <el-table-column label="IP 地址" prop="ipAddress" min-width="125"><template #default="{ row }"><span class="mono">{{ row.ipAddress || '--' }}</span></template></el-table-column>
          <el-table-column label="详情" width="88" fixed="right">
            <template #default="{ row }"><el-button link type="primary" :icon="View" aria-label="查看日志详情" @click="openDetail(row)">查看</el-button></template>
          </el-table-column>
        </el-table>
        <div class="mobile-events">
          <button v-for="log in logs" :key="log.id" class="event-item" data-test="view-log" type="button" @click="openDetail(log)">
            <span class="event-dot" /><span class="event-content"><strong>{{ auditActionLabel(log.action) }}</strong><span>{{ log.username || log.userId || '--' }} · {{ formatTime(log.createdAt) }}</span></span><el-icon><View /></el-icon>
          </button>
        </div>
        <div class="pagination-wrap"><el-pagination v-model:current-page="page" v-model:page-size="pageSize" :total="total" layout="total, sizes, prev, pager, next" :page-sizes="[20, 50, 100]" /></div>
      </template>
      <div v-else class="empty-state">
        <div class="empty-glyph">⌁</div>
        <h2>{{ hasFilters ? '没有匹配的审计记录' : '暂无审计记录' }}</h2>
        <p>{{ hasFilters ? '尝试调整筛选条件，或清空筛选后重新查看。' : '系统产生操作记录后，会在这里显示。' }}</p>
        <el-button v-if="hasFilters" data-test="reset-filters" type="primary" plain @click="resetFilters">清空筛选</el-button>
      </div>
    </section>

    <el-drawer v-model="drawerVisible" title="日志详情" :size="'min(560px, 92vw)'">
      <template v-if="selectedLog">
        <div class="drawer-action"><el-tag :type="auditActionTagType(selectedLog.action)">{{ auditActionLabel(selectedLog.action) }}</el-tag><span class="drawer-time">{{ formatTime(selectedLog.createdAt) }}</span></div>
        <dl class="detail-grid">
          <div><dt>用户</dt><dd>{{ selectedLog.username || selectedLog.userId || '--' }}</dd></div>
          <div><dt>资源</dt><dd class="entity-cell"><span>{{ entityTypeLabel(selectedLog.entityType) }} / {{ selectedLog.entityId || '--' }}</span><el-button v-if="selectedLog.entityId" text :icon="CopyDocument" aria-label="复制实体 ID" @click="copyValue(selectedLog.entityId, '实体 ID')" /></dd></div>
          <div><dt>知识库</dt><dd>{{ selectedLog.kbName || selectedLog.kbId || '--' }}</dd></div>
          <div><dt>IP 地址</dt><dd class="mono">{{ selectedLog.ipAddress || '--' }}</dd></div>
        </dl>
        <div class="detail-block"><div class="detail-heading"><span>日志 ID</span><el-button text :icon="CopyDocument" aria-label="复制日志 ID" @click="copyValue(selectedLog.id, '日志 ID')" /></div><code>{{ selectedLog.id }}</code></div>
        <div class="detail-block"><div class="detail-heading"><span>事件详情</span></div><pre>{{ formatAuditDetails(selectedLog.details) }}</pre></div>
      </template>
    </el-drawer>
  </main>
</template>

<style scoped>
.audit-page { color: var(--foreground); animation: rise-in .35s ease-out both; }
.audit-header { display:flex; align-items:center; justify-content:space-between; margin-bottom:24px; }
.audit-title-wrap { display:flex; align-items:center; gap:12px; }
.audit-mark { display:flex; align-items:center; justify-content:center; width:40px; height:40px; border-radius:12px; background:var(--brand-gradient); box-shadow:0 8px 20px -8px color-mix(in oklch, var(--accent) 55%, transparent); }
.audit-title { margin:0; font-family:var(--font-display, inherit); font-size:1.5rem; font-weight:700; letter-spacing:-.025em; }
.audit-subtitle { margin:2px 0 0; font-size:.75rem; opacity:.55; }
.audit-stats { display:grid; grid-template-columns:repeat(3,1fr); gap:12px; margin-bottom:18px; }
.stat-card,.filter-panel,.table-panel { border:1px solid var(--border); background:var(--surface); border-radius:14px; }
.stat-card { padding:16px 18px; display:flex; flex-direction:column; gap:3px; }
.stat-label,.stat-hint { font-size:.72rem; opacity:.55; }.stat-card strong { font-family:var(--font-mono, monospace); font-size:1.45rem; }.stat-time { font-size:1rem!important; }
.filter-panel { padding:14px; margin-bottom:14px; }.filter-row { display:flex; gap:10px; flex-wrap:wrap; }.filter-row > * { min-width:140px; flex:1; }.filter-row > :first-child { min-width:230px; flex:1.5; }
.audit-error { margin-bottom:14px; }.table-panel { overflow:hidden; padding:4px; }.audit-table { --el-table-border-color:transparent; --el-table-header-bg-color:var(--surface-secondary); background:transparent; }.event-time,.mono,code { font-family:var(--font-mono, monospace); font-size:.76rem; }.muted-id { display:block; font-size:.72rem; opacity:.55; margin-top:2px; }.pagination-wrap { display:flex; justify-content:flex-end; padding:14px 10px 8px; }.mobile-events { display:none; }
.empty-state { min-height:300px; display:flex; flex-direction:column; align-items:center; justify-content:center; text-align:center; padding:30px; }.empty-glyph { font-size:3rem; color:var(--accent); opacity:.55; }.empty-state h2 { margin:8px 0 4px; font-size:1rem; }.empty-state p { margin:0 0 16px; font-size:.8rem; opacity:.55; }
.drawer-action { display:flex; align-items:center; justify-content:space-between; margin-bottom:22px; }.drawer-time { font-family:var(--font-mono, monospace); font-size:.72rem; opacity:.6; }.detail-grid { display:grid; grid-template-columns:1fr 1fr; gap:18px 14px; margin:0 0 24px; }.detail-grid div { min-width:0; }.detail-grid dt { font-size:.7rem; opacity:.55; margin-bottom:5px; }.detail-grid dd { margin:0; font-size:.85rem; word-break:break-word; }.entity-cell { display:flex; align-items:center; gap:4px; }.detail-block { margin-top:18px; }.detail-heading { display:flex; justify-content:space-between; align-items:center; font-size:.75rem; opacity:.7; margin-bottom:7px; }.detail-block code,.detail-block pre { display:block; margin:0; padding:12px; border-radius:8px; background:var(--surface-secondary); overflow:auto; white-space:pre-wrap; word-break:break-word; }.detail-block pre { font-size:.75rem; line-height:1.6; }
button:focus-visible,.audit-page :deep(button:focus-visible),.audit-page :deep(input:focus-visible) { outline:2px solid var(--accent); outline-offset:2px; }
@media (max-width: 640px) { .audit-stats { grid-template-columns:1fr 1fr; }.stat-card:last-child { grid-column:1/-1; }.filter-row > *,.filter-row > :first-child { min-width:100%; }.audit-table { display:none; }.pagination-wrap { justify-content:flex-start; overflow-x:auto; }.mobile-events { display:block; position:relative; }.mobile-events::before { content:''; position:absolute; left:13px; top:20px; bottom:20px; width:2px; background:color-mix(in oklch, var(--accent) 22%, transparent); border-radius:2px; }.event-item { position:relative; z-index:1; width:100%; display:flex; align-items:center; gap:10px; padding:14px 10px; border:0; border-bottom:1px solid var(--border); background:transparent; color:inherit; text-align:left; cursor:pointer; }.event-item:last-child { border-bottom:0; }.event-dot { flex-shrink:0; width:8px; height:8px; border-radius:50%; background:var(--accent); box-shadow:0 0 0 4px var(--surface); }.event-content { display:flex; flex:1; flex-direction:column; gap:4px; font-size:.75rem; }.event-content span { opacity:.55; }.detail-grid { grid-template-columns:1fr; } }
@media (prefers-reduced-motion: reduce) { .audit-page { animation:none; } }
</style>
