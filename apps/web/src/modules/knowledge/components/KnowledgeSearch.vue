<script setup lang="ts">
import { ref, computed } from 'vue'
import { Search } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import { useRetrieval } from '@/modules/knowledge/composables/useRetrieval'
import type { SearchResponse } from '@/modules/knowledge/types/retrieval'

const props = defineProps<{
  kbId: string
}>()

// ── 搜索状态 ──
const query = ref('')
const topK = ref(5)
const hasSearched = ref(false)

const retrieval = useRetrieval()

// ── 派生状态 ──
const isLoading = computed(() => retrieval.isPending.value)
const response = computed(() => retrieval.data.value as SearchResponse | undefined)
const results = computed(() => response.value?.results ?? [])
const strategy = computed(() => response.value?.strategy ?? '')
const totalCandidates = computed(() => response.value?.totalCandidates ?? 0)
const canSearch = computed(() => query.value.trim().length > 0 && !isLoading.value)

// ── 分数 → tag 颜色 ──
function scoreTagType(score: number): 'success' | 'warning' | 'info' {
  if (score >= 0.8) return 'success'
  if (score >= 0.5) return 'warning'
  return 'info'
}

function scoreLabel(score: number): string {
  return (score * 100).toFixed(1) + '%'
}

function handleClear() {
  query.value = ''
  hasSearched.value = false
  // 重置 mutation，清空检索数据（表格 results 随之清空）
  retrieval.reset()
}

// ── 搜索 ──
async function handleSearch() {
  if (!query.value.trim()) {
    ElMessage.warning('请输入搜索关键词')
    return
  }
  hasSearched.value = true
  await retrieval.mutateAsync({
    query: query.value.trim(),
    kbId: props.kbId,
    topK: topK.value,
  })
}
</script>

<template>
  <div class="knowledge-search">
    <!-- 搜索栏 -->
    <el-card class="mb-4">
      <div class="flex items-center gap-3">
        <el-input
          v-model="query"
          placeholder="输入检索关键词"
          :prefix-icon="Search"
          clearable
          class="flex-1"
          @clear="handleClear"
          @keyup.enter="handleSearch"
        />
        <span
          class="text-sm shrink-0"
          style="color: var(--foreground); opacity: 0.6"
        >返回条数</span>
        <el-input-number
          v-model="topK"
          :min="1"
          :max="10"
          :step="1"
          style="width: 110px"
        />
        <el-button
          type="primary"
          :icon="Search"
          :loading="isLoading"
          :disabled="!canSearch"
          @click="handleSearch"
        >
          搜索
        </el-button>
      </div>
    </el-card>

    <!-- 结果区域 -->
    <el-card v-if="hasSearched">
      <!-- 结果统计（仅在有结果时展示） -->
      <div
        v-if="results.length > 0"
        class="flex items-center gap-4 mb-4 text-sm"
        style="color: var(--foreground); opacity: 0.6"
      >
        <span>检索结果（{{ results.length }} 条）</span>
        <span>策略: <strong>{{ strategy }}</strong></span>
        <span>候选数: {{ totalCandidates }}</span>
      </div>

      <!-- 结果表格：加载中/空结果均由表格自身展示 -->
      <div class="search-resulte-box">
        <el-table
          v-loading="isLoading"
          :data="results"
          stripe
          border
          height="100%"
          empty-text="未找到相关结果，请尝试其他关键词"
        >
          <el-table-column
            type="expand"
          >
            <template #default="{ row }">
              <div class="expand-content">
                <div class="mb-3 text-sm font-medium">
                  {{ row.citation.documentName }} · {{ row.citation.version }}
                </div>
                <div class="text-sm leading-6 whitespace-pre-wrap">
                  {{ row.content }}
                </div>
                <div
                  v-if="row.citation.snippet !== row.content"
                  class="mt-3 text-xs leading-5 rounded px-2 py-1"
                  style="background: var(--el-fill-color-light); color: var(--foreground); opacity: 0.7"
                >
                  引用片段: {{ row.citation.snippet }}
                </div>
              </div>
            </template>
          </el-table-column>

          <el-table-column
            label="#"
            type="index"
            width="60"
            align="center"
          />

          <el-table-column
            label="标题"
            min-width="200"
            show-overflow-tooltip
          >
            <template #default="{ row }">
              {{ row.documentName }} · 第{{ row.page }}页
            </template>
          </el-table-column>

          <el-table-column
            label="内容"
            min-width="320"
          >
            <template #default="{ row }">
              <div class="content-preview">
                {{ row.content }}
              </div>
            </template>
          </el-table-column>

          <el-table-column
            label="相关性"
            width="120"
            align="center"
          >
            <template #default="{ row }">
              <el-tag
                :type="scoreTagType(row.score)"
                size="small"
                effect="plain"
              >
                {{ scoreLabel(row.score) }}
              </el-tag>
            </template>
          </el-table-column>

          <el-table-column
            label="Token"
            width="90"
            align="right"
          >
            <template #default="{ row }">
              {{ row.tokenCount }}
            </template>
          </el-table-column>

          <el-table-column
            label="引用"
            width="100"
            align="center"
          >
            <template #default="{ row }">
              <el-tag
                size="small"
                effect="plain"
              >
                {{ row.citation.version }}
              </el-tag>
            </template>
          </el-table-column>
        </el-table>
      </div>
    </el-card>
  </div>
</template>

<style scoped>
.search-resulte-box {
  height: calc(100vh - 474px);
}

.content-preview {
  overflow: hidden;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}

.expand-content {
  padding: 12px 16px;
  max-width: 900px;
}
</style>
