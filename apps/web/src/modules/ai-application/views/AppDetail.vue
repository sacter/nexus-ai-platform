<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  ArrowLeft,
  ChatDotSquare,
  Delete,
  Edit,
  Plus,
  Promotion,
  VideoPause,
} from '@element-plus/icons-vue'
import {
  useAiApplication,
  useBindTool,
  useDeleteAiApplication,
  useUnbindTool,
  useUpdateAiApplication,
} from '@/modules/ai-application/composables/useAiApplications'
import { useTools } from '@/modules/tools/composables/useTools'
import { chatApi } from '@/modules/chat/api/chat.api'
import { DEFAULT_WORKFLOW_TYPE } from '@nexus/config'
import AppAssemblyDiagram from '@/modules/ai-application/components/AppAssemblyDiagram.vue'
import {
  appIconGlyph,
  statusMeta,
} from '@/modules/ai-application/types/ai-application'
import { formatDate } from '@/utils/format'

interface ToolOption {
  id: string
  name: string
  displayName?: string
  type: string
  description?: string | null
}

const route = useRoute()
const router = useRouter()
const appId = String(route.params.appId ?? '')

const { data: app, isLoading } = useAiApplication(appId)
const { data: tools } = useTools()
const updateMutation = useUpdateAiApplication()
const deleteMutation = useDeleteAiApplication()
const bindMutation = useBindTool()
const unbindMutation = useUnbindTool()

const status = computed(() => statusMeta(app.value?.status))
const config = computed(() => app.value?.config ?? {})
const suggestedQuestions = computed(
  () => config.value.suggestedQuestions ?? [],
)

// ---- 测试对话：快捷模式建会话（后端快照应用装配），跳转对话页 ----
const testing = ref(false)
async function handleTest() {
  if (!app.value) return
  testing.value = true
  try {
    const session = await chatApi.createSession({
      title: `${app.value.name} · 试用`,
      aiApplicationId: appId,
      workflowType: DEFAULT_WORKFLOW_TYPE,
    })
    router.push(`/chat/${session.id}`)
  } catch (e) {
    ElMessage.error((e as Error).message || '创建试用会话失败')
  } finally {
    testing.value = false
  }
}

// ---- 发布 / 停用 ----
async function handleSetStatus(next: 'active' | 'inactive') {
  try {
    await updateMutation.mutateAsync({ id: appId, data: { status: next } })
    ElMessage.success(next === 'active' ? '应用已发布' : '应用已停用')
  } catch (e) {
    ElMessage.error((e as Error).message || '操作失败')
  }
}

function handleEdit() {
  router.push(`/ai-applications/${appId}/edit`)
}

async function handleDelete() {
  try {
    await ElMessageBox.confirm(
      `删除后，使用该应用的已有会话不受影响（配置已快照）。确定删除「${app.value?.name}」？`,
      '删除应用',
      { confirmButtonText: '删除', cancelButtonText: '取消', type: 'warning' },
    )
  } catch {
    return
  }
  deleteMutation.mutate(appId, {
    onSuccess: () => {
      ElMessage.success('应用已删除')
      router.push('/ai-applications')
    },
    onError: (e) => ElMessage.error((e as Error).message || '删除失败'),
  })
}

// ---- 工具绑定 ----
const bindDialogVisible = ref(false)
const bindToolId = ref('')
const boundToolIds = computed(
  () => new Set((app.value?.tools ?? []).map((t) => t.toolId)),
)
const bindCandidates = computed(
  () =>
    ((tools.value ?? []) as unknown as ToolOption[]).filter(
      (t) => !boundToolIds.value.has(t.id),
    ),
)

function openBindDialog() {
  bindToolId.value = ''
  bindDialogVisible.value = true
}

async function handleBind() {
  if (!bindToolId.value) return
  try {
    await bindMutation.mutateAsync({ id: appId, toolId: bindToolId.value })
    ElMessage.success('工具已绑定')
    bindDialogVisible.value = false
  } catch (e) {
    ElMessage.error((e as Error).message || '绑定失败')
  }
}

function handleUnbind(toolId: string) {
  unbindMutation.mutate(
    { id: appId, toolId },
    {
      onSuccess: () => ElMessage.success('工具已解绑'),
      onError: (e) => ElMessage.error((e as Error).message || '解绑失败'),
    },
  )
}
</script>

<template>
  <div>
    <el-skeleton
      v-if="isLoading"
      animated
      :rows="8"
    />

    <template v-else-if="app">
      <div class="mb-4">
        <el-button
          text
          :icon="ArrowLeft"
          @click="router.push('/ai-applications')"
        >
          返回列表
        </el-button>
      </div>

      <!-- 页头：身份 + 操作 -->
      <div class="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div class="flex items-start gap-3">
          <div
            class="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-2xl"
            style="background: var(--brand-gradient); box-shadow: 0 8px 20px -8px color-mix(in oklch, var(--accent) 55%, transparent)"
          >
            {{ appIconGlyph(app.icon) }}
          </div>
          <div>
            <div class="flex items-center gap-2">
              <h1
                class="font-display text-2xl font-bold tracking-tight"
                style="color: var(--foreground)"
              >
                {{ app.name }}
              </h1>
              <el-tag
                :type="status.tagType"
                effect="light"
              >
                {{ status.label }}
              </el-tag>
            </div>
            <p
              class="mt-1 text-xs"
              style="color: var(--foreground); opacity: 0.55"
            >
              {{ app.description || '暂无描述' }}
            </p>
          </div>
        </div>
        <div class="flex flex-wrap items-center gap-2">
          <el-button
            type="primary"
            :icon="ChatDotSquare"
            :loading="testing"
            @click="handleTest"
          >
            测试对话
          </el-button>
          <el-button
            v-if="app.status !== 'active'"
            :icon="Promotion"
            @click="handleSetStatus('active')"
          >
            发布
          </el-button>
          <el-button
            v-else
            :icon="VideoPause"
            @click="handleSetStatus('inactive')"
          >
            停用
          </el-button>
          <el-button
            :icon="Edit"
            @click="handleEdit"
          >
            编辑
          </el-button>
          <el-button
            type="danger"
            plain
            :icon="Delete"
            @click="handleDelete"
          >
            删除
          </el-button>
        </div>
      </div>

      <!-- 装配图（签名元素） -->
      <el-card class="mb-4">
        <AppAssemblyDiagram :app="app" />
      </el-card>

      <div class="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <!-- 运行配置 -->
        <el-card>
          <h2
            class="mb-4 text-sm font-semibold"
            style="color: var(--foreground)"
          >
            运行配置
          </h2>
          <div class="mb-4 flex gap-6">
            <div>
              <div
                class="text-[11px] tracking-wider"
                style="color: var(--foreground); opacity: 0.5"
              >
                TEMPERATURE
              </div>
              <div
                class="font-display text-xl font-bold"
                style="color: var(--foreground)"
              >
                {{ config.temperature ?? 0.7 }}
              </div>
            </div>
            <div>
              <div
                class="text-[11px] tracking-wider"
                style="color: var(--foreground); opacity: 0.5"
              >
                MAX TOKENS
              </div>
              <div
                class="font-display text-xl font-bold"
                style="color: var(--foreground)"
              >
                {{ config.maxTokens ?? 4096 }}
              </div>
            </div>
          </div>
          <template v-if="config.welcomeMessage">
            <div
              class="mb-1 text-[11px] tracking-wider"
              style="color: var(--foreground); opacity: 0.5"
            >
              欢迎语
            </div>
            <blockquote
              class="mb-4 rounded-lg px-3 py-2 text-sm"
              style="background: var(--surface-secondary); color: var(--foreground); border-left: 3px solid var(--accent)"
            >
              {{ config.welcomeMessage }}
            </blockquote>
          </template>
          <template v-if="suggestedQuestions.length">
            <div
              class="mb-2 text-[11px] tracking-wider"
              style="color: var(--foreground); opacity: 0.5"
            >
              建议问题
            </div>
            <div class="flex flex-wrap gap-2">
              <el-tag
                v-for="q in suggestedQuestions"
                :key="q"
                effect="plain"
                round
              >
                {{ q }}
              </el-tag>
            </div>
          </template>
          <p
            v-if="!config.welcomeMessage && !suggestedQuestions.length"
            class="text-xs"
            style="color: var(--foreground); opacity: 0.45"
          >
            未配置欢迎语与建议问题
          </p>
        </el-card>

        <!-- 绑定工具 -->
        <el-card>
          <div class="mb-4 flex items-center justify-between">
            <h2
              class="text-sm font-semibold"
              style="color: var(--foreground)"
            >
              绑定工具
            </h2>
            <el-button
              size="small"
              :icon="Plus"
              @click="openBindDialog"
            >
              绑定工具
            </el-button>
          </div>
          <el-empty
            v-if="!app.tools.length"
            description="尚未绑定工具"
            :image-size="60"
          />
          <ul
            v-else
            class="flex flex-col gap-2"
          >
            <li
              v-for="tool in app.tools"
              :key="tool.toolId"
              class="flex items-center justify-between rounded-lg px-3 py-2"
              style="background: var(--surface-secondary)"
            >
              <div class="min-w-0">
                <div class="flex items-center gap-2">
                  <span
                    class="truncate text-sm font-medium"
                    style="color: var(--foreground)"
                  >
                    {{ tool.displayName }}
                  </span>
                  <el-tag
                    size="small"
                    effect="plain"
                  >
                    {{ tool.type }}
                  </el-tag>
                </div>
                <p
                  v-if="tool.description"
                  class="mt-0.5 truncate text-xs"
                  style="color: var(--foreground); opacity: 0.5"
                >
                  {{ tool.description }}
                </p>
              </div>
              <el-popconfirm
                :title="`解绑工具「${tool.displayName}」？`"
                confirm-button-text="解绑"
                cancel-button-text="取消"
                width="240"
                @confirm="handleUnbind(tool.toolId)"
              >
                <template #reference>
                  <el-button
                    text
                    type="danger"
                    size="small"
                    aria-label="解绑"
                  >
                    <el-icon :size="15">
                      <Delete />
                    </el-icon>
                  </el-button>
                </template>
              </el-popconfirm>
            </li>
          </ul>
        </el-card>
      </div>

      <p
        class="mt-4 text-[11px]"
        style="color: var(--foreground); opacity: 0.45"
      >
        创建于 {{ formatDate(app.createdAt) }} · 更新于
        {{ formatDate(app.updatedAt) }} · 使用该应用发起的会话会快照当前装配，后续修改不影响已有会话
      </p>
    </template>

    <el-result
      v-else
      icon="error"
      title="应用不存在"
    >
      <template #extra>
        <el-button
          type="primary"
          @click="router.push('/ai-applications')"
        >
          返回列表
        </el-button>
      </template>
    </el-result>

    <!-- 绑定工具对话框 -->
    <el-dialog
      v-model="bindDialogVisible"
      title="绑定工具"
      width="440px"
    >
      <el-select
        v-model="bindToolId"
        placeholder="选择要绑定的工具"
        filterable
        class="w-full"
      >
        <el-option
          v-for="tool in bindCandidates"
          :key="tool.id"
          :label="`${tool.displayName || tool.name}（${tool.type}）`"
          :value="tool.id"
        />
      </el-select>
      <p
        v-if="!bindCandidates.length"
        class="mt-2 text-xs"
        style="color: var(--foreground); opacity: 0.55"
      >
        所有可用工具均已绑定
      </p>
      <template #footer>
        <el-button @click="bindDialogVisible = false">
          取消
        </el-button>
        <el-button
          type="primary"
          :disabled="!bindToolId"
          :loading="bindMutation.isPending.value"
          @click="handleBind"
        >
          绑定
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>
