<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  ArrowDown,
  Document as DocumentIcon,
  Refresh,
  Search,
  Timer,
} from '@element-plus/icons-vue'
import JobTable from '@/modules/knowledge/components/JobTable.vue'
import { useCancelJob, useJobs, useRetryJob } from '@/modules/knowledge/composables/useJobs'
import type { IndexJob, JobStatus, JobType } from '@/modules/knowledge/types/job'
import {
  JOB_STATUS_OPTIONS,
  JOB_TYPE_OPTIONS,
  jobDuration,
  jobStatusLabel,
  jobStatusTagType,
  jobSummary,
  jobTypeLabel,
} from '@/modules/knowledge/utils/job-display'
import { formatDate } from '@/utils/format'

const page = ref(1)
const pageSize = ref(10)
const detailVisible = ref(false)
const selectedId = ref('')

const filters = reactive<{
  status: JobStatus | ''
  type: JobType | ''
  keyword: string
}>({
  status: '',
  type: '',
  keyword: '',
})

const params = computed(() => ({
  page: page.value,
  pageSize: pageSize.value,
  status: filters.status,
  type: filters.type,
  keyword: filters.keyword.trim() || undefined,
}))

const { data, isLoading, isFetching, refetch } = useJobs(params)
const cancelMutation = useCancelJob()
const retryMutation = useRetryJob()

const jobs = computed(() => data.value?.items ?? [])
const total = computed(() => data.value?.total ?? 0)
const selectedJob = computed(() => jobs.value.find((job) => job.id === selectedId.value) ?? null)
const activeCount = computed(
  () => jobs.value.filter((job) => job.status === 'PENDING' || job.status === 'RUNNING').length,
)
const failedCount = computed(() => jobs.value.filter((job) => job.status === 'FAILED').length)
const latestUpdatedAt = computed(() => jobs.value[0]?.updatedAt ?? null)

watch([() => filters.status, () => filters.type, () => filters.keyword], () => {
  page.value = 1
})

watch(total, (value) => {
  const maxPage = Math.max(1, Math.ceil(value / pageSize.value))
  if (page.value > maxPage) page.value = maxPage
})

function resetFilters() {
  filters.status = ''
  filters.type = ''
  filters.keyword = ''
}

function inspect(job: IndexJob) {
  selectedId.value = job.id
  detailVisible.value = true
}

async function copyJobId(id: string) {
  try {
    await navigator.clipboard.writeText(id)
    ElMessage.success('任务 ID 已复制')
  } catch {
    ElMessage.error('复制失败，请手动复制')
  }
}

async function cancel(job: IndexJob) {
  try {
    await ElMessageBox.confirm(
      `确定取消「${job.documentName}」的${jobTypeLabel(job.type)}任务？任务会标记为失败。`,
      '取消任务',
      { confirmButtonText: '取消任务', cancelButtonText: '返回', type: 'warning' },
    )
    await cancelMutation.mutateAsync(job.id)
    ElMessage.success('任务已取消')
  } catch (e) {
    if (e !== 'cancel' && e !== 'close') {
      ElMessage.error((e as Error).message || '取消任务失败')
    }
  }
}

async function retry(job: IndexJob) {
  try {
    await retryMutation.mutateAsync(job.id)
    ElMessage.success('任务已重新排队')
  } catch (e) {
    ElMessage.error((e as Error).message || '重试任务失败')
  }
}
</script>

<template>
  <div class="job-page">
    <div class="mb-6 flex flex-wrap items-start justify-between gap-4">
      <div class="flex items-start gap-3">
        <div class="job-mark flex h-11 w-11 shrink-0 items-center justify-center rounded-xl">
          <el-icon :size="20">
            <Timer />
          </el-icon>
        </div>
        <div>
          <div class="flex items-center gap-2">
            <h1
              class="font-display text-2xl font-bold tracking-tight"
              style="color: var(--foreground)"
            >
              索引任务
            </h1>
            <el-tag
              size="small"
              effect="plain"
            >
              {{ total }} 个任务
            </el-tag>
          </div>
          <p
            class="mt-1 text-xs"
            style="color: var(--foreground); opacity: 0.55"
          >
            跟踪文档切片、向量化和清理任务的执行进度
          </p>
        </div>
      </div>
      <el-button
        :icon="Refresh"
        :loading="isFetching"
        @click="refetch()"
      >
        刷新
      </el-button>
    </div>

    <div class="job-overview mb-5">
      <div class="overview-card">
        <span class="overview-label">当前活跃</span>
        <strong>{{ activeCount }}</strong>
        <span class="overview-note">排队或执行中</span>
      </div>
      <div class="overview-card">
        <span class="overview-label">失败待处理</span>
        <strong>{{ failedCount }}</strong>
        <span class="overview-note">可查看原因并重试</span>
      </div>
      <div class="overview-card">
        <span class="overview-label">最近更新</span>
        <strong>{{ latestUpdatedAt ? formatDate(latestUpdatedAt, 'hh:mm:ss') : '--' }}</strong>
        <span class="overview-note">每 5 秒自动轮询</span>
      </div>
    </div>

    <div class="mb-4 flex flex-wrap items-center gap-3">
      <el-input
        v-model="filters.keyword"
        clearable
        :prefix-icon="Search"
        placeholder="搜索文档名称"
        class="max-w-sm"
      />
      <el-select
        v-model="filters.status"
        class="w-36"
        :suffix-icon="ArrowDown"
      >
        <el-option
          v-for="item in JOB_STATUS_OPTIONS"
          :key="item.label"
          :label="item.label"
          :value="item.value"
        />
      </el-select>
      <el-select
        v-model="filters.type"
        class="w-36"
        :suffix-icon="ArrowDown"
      >
        <el-option
          v-for="item in JOB_TYPE_OPTIONS"
          :key="item.label"
          :label="item.label"
          :value="item.value"
        />
      </el-select>
      <el-button
        text
        @click="resetFilters"
      >
        重置筛选
      </el-button>
      <span
        class="text-xs"
        style="color: var(--foreground); opacity: 0.5"
      >
        {{ jobs.length }} / {{ total }} 条结果
      </span>
    </div>

    <el-skeleton
      v-if="isLoading"
      animated
      :rows="8"
    />
    <template v-else>
      <JobTable
        v-if="jobs.length"
        :jobs="jobs"
        :loading="isFetching"
        @cancel="cancel"
        @retry="retry"
        @inspect="inspect"
        @copy="copyJobId"
      >
        <template #progress="{ job }">
          <div
            class="job-progress"
            :class="`job-progress--${job.status.toLowerCase()}`"
          >
            <div
              class="job-progress__rail"
              aria-hidden="true"
            >
              <span
                class="job-progress__fill"
                :style="{ width: `${Math.max(0, Math.min(100, job.progress))}%` }"
              />
            </div>
            <div class="job-progress__meta">
              <span>{{ job.progress }}%</span>
              <span>{{ jobSummary(job) }}</span>
            </div>
            <div
              v-if="job.errorMessage"
              class="job-progress__error"
            >
              {{ job.errorMessage }}
            </div>
          </div>
        </template>
      </JobTable>
      <el-empty
        v-else
        :description="filters.keyword || filters.status || filters.type ? '没有匹配的索引任务' : '暂无索引任务'"
      >
        <el-button
          v-if="filters.keyword || filters.status || filters.type"
          type="primary"
          @click="resetFilters"
        >
          清空筛选
        </el-button>
      </el-empty>
      <div
        v-if="total > pageSize"
        class="mt-5 flex justify-end"
      >
        <el-pagination
          v-model:current-page="page"
          v-model:page-size="pageSize"
          :total="total"
          :page-sizes="[10, 20, 50]"
          layout="total, sizes, prev, pager, next"
        />
      </div>
    </template>

    <el-drawer
      v-model="detailVisible"
      title="任务详情"
      size="min(520px, 92vw)"
    >
      <div
        v-if="selectedJob"
        class="job-detail"
      >
        <div class="job-detail__hero">
          <div class="flex items-start justify-between gap-3">
            <div class="min-w-0">
              <div class="job-detail__eyebrow">
                INDEX PIPELINE
              </div>
              <h2 class="job-detail__title">
                {{ selectedJob.documentName }}
              </h2>
              <p class="job-detail__subtitle">
                {{ selectedJob.kbName }}<span v-if="selectedJob.versionNumber"> · 文档版本 v{{ selectedJob.versionNumber }}</span>
              </p>
            </div>
            <el-tag
              :type="jobStatusTagType(selectedJob.status)"
              effect="light"
            >
              {{ jobStatusLabel(selectedJob.status) }}
            </el-tag>
          </div>
          <div class="job-detail__track">
            <div
              class="job-progress__rail job-progress__rail--large"
              aria-hidden="true"
            >
              <span
                class="job-progress__fill"
                :style="{ width: `${Math.max(0, Math.min(100, selectedJob.progress))}%` }"
              />
            </div>
            <div class="job-detail__track-meta">
              <span>{{ selectedJob.progress }}%</span>
              <span>{{ jobSummary(selectedJob) }}</span>
            </div>
          </div>
        </div>

        <div class="job-detail__grid">
          <div class="job-detail__item">
            <span>任务类型</span>
            <strong>{{ jobTypeLabel(selectedJob.type) }}</strong>
          </div>
          <div class="job-detail__item">
            <span>重试次数</span>
            <strong>{{ selectedJob.retryCount }}</strong>
          </div>
          <div class="job-detail__item">
            <span>耗时</span>
            <strong>{{ jobDuration(selectedJob) }}</strong>
          </div>
          <div class="job-detail__item">
            <span>创建时间</span>
            <strong>{{ formatDate(selectedJob.createdAt, 'yyyy-mm-dd hh:mm:ss') }}</strong>
          </div>
          <div class="job-detail__item">
            <span>开始时间</span>
            <strong>{{ selectedJob.startedAt ? formatDate(selectedJob.startedAt, 'yyyy-mm-dd hh:mm:ss') : '--' }}</strong>
          </div>
          <div class="job-detail__item">
            <span>完成时间</span>
            <strong>{{ selectedJob.completedAt ? formatDate(selectedJob.completedAt, 'yyyy-mm-dd hh:mm:ss') : '--' }}</strong>
          </div>
        </div>

        <div class="job-detail__section">
          <div class="job-detail__section-title">
            上下文
          </div>
          <div class="job-detail__context">
            <div><DocumentIcon class="mr-1 inline-block" /> 文档 ID：{{ selectedJob.documentId }}</div>
            <div>版本 ID：{{ selectedJob.versionId || '--' }}</div>
            <div>幂等键：{{ selectedJob.bizId || '--' }}</div>
          </div>
        </div>

        <div
          v-if="selectedJob.errorMessage"
          class="job-detail__error"
        >
          <div class="job-detail__section-title">
            失败原因
          </div>
          <p>{{ selectedJob.errorMessage }}</p>
        </div>
      </div>
    </el-drawer>
  </div>
</template>

<style scoped>
.job-page {
  --track: color-mix(in oklch, var(--surface-secondary) 78%, var(--border));
  --track-fill: var(--brand-gradient);
}
.job-mark {
  color: #fff;
  background: var(--brand-gradient);
  box-shadow: 0 10px 24px -12px color-mix(in oklch, var(--accent) 70%, transparent);
}
.job-overview {
  display: grid;
  grid-template-columns: repeat(1, minmax(0, 1fr));
  gap: 14px;
}
@media (min-width: 900px) {
  .job-overview {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}
.overview-card,
.job-detail__hero,
.job-detail__item,
.job-detail__context,
.job-detail__error {
  border: 1px solid var(--border);
  border-radius: 10px;
  background: var(--surface);
}
.overview-card {
  padding: 16px;
  display: grid;
  gap: 6px;
}
.overview-label,
.overview-note {
  color: var(--foreground);
  opacity: 0.55;
  font-size: 12px;
}
.overview-card strong {
  color: var(--foreground);
  font-size: 26px;
  line-height: 1;
}
.job-progress {
  display: grid;
  gap: 8px;
  min-width: 0;
}
.job-progress__rail {
  position: relative;
  height: 8px;
  overflow: hidden;
  border-radius: 999px;
  background: var(--track);
}
.job-progress__rail--large {
  height: 12px;
}
.job-progress__fill {
  position: absolute;
  inset: 0 auto 0 0;
  border-radius: inherit;
  background: var(--track-fill);
  transition: width 220ms ease;
}
.job-progress--failed .job-progress__fill {
  background: linear-gradient(135deg, var(--el-color-danger), color-mix(in oklch, var(--el-color-danger) 72%, #000));
}
.job-progress--done .job-progress__fill {
  background: linear-gradient(135deg, var(--el-color-success), color-mix(in oklch, var(--el-color-success) 72%, #000));
}
.job-progress__meta,
.job-detail__track-meta {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  color: var(--foreground);
  opacity: 0.7;
  font-size: 12px;
}
.job-progress__error {
  color: var(--el-color-danger);
  font-size: 12px;
  line-height: 1.5;
}
.job-detail {
  display: grid;
  gap: 16px;
}
.job-detail__hero,
.job-detail__item,
.job-detail__context,
.job-detail__error {
  padding: 16px;
}
.job-detail__eyebrow {
  color: var(--accent);
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.14em;
}
.job-detail__title {
  color: var(--foreground);
  font-size: 20px;
  font-weight: 700;
}
.job-detail__subtitle {
  margin-top: 6px;
  color: var(--foreground);
  opacity: 0.58;
  font-size: 12px;
}
.job-detail__track {
  margin-top: 18px;
  display: grid;
  gap: 8px;
}
.job-detail__grid {
  display: grid;
  grid-template-columns: repeat(1, minmax(0, 1fr));
  gap: 12px;
}
@media (min-width: 640px) {
  .job-detail__grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
.job-detail__item {
  display: grid;
  gap: 6px;
}
.job-detail__item span,
.job-detail__section-title {
  color: var(--foreground);
  opacity: 0.52;
  font-size: 12px;
}
.job-detail__item strong {
  color: var(--foreground);
  font-size: 14px;
  word-break: break-word;
}
.job-detail__context {
  display: grid;
  gap: 10px;
  color: var(--foreground);
  opacity: 0.78;
  font-size: 12px;
  word-break: break-all;
}
.job-detail__error p {
  margin: 8px 0 0;
  color: var(--el-color-danger);
  line-height: 1.7;
  font-size: 13px;
}
@media (prefers-reduced-motion: reduce) {
  .job-progress__fill {
    transition: none;
  }
}
</style>
