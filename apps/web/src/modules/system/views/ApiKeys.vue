<script setup lang="ts">
import { computed, ref } from 'vue'
import { ElMessage } from 'element-plus'
import {
  Plus,
  Key,
  WarningFilled,
  CopyDocument,
  Check,
  Delete,
  Edit,
} from '@element-plus/icons-vue'
import {
  useApiKeys,
  useCreateApiKey,
  useUpdateApiKey,
  useDeleteApiKey,
} from '@/modules/system/composables/useApiKeys'
import { formatDate } from '@/utils/format'
import { PROVIDERS } from '@/modules/system/types/api-key'
import type { ApiKey, ApiKeyCreateResult, ProviderId } from '@/modules/system/types/api-key'

const { data: keys, isLoading } = useApiKeys()
const createMutation = useCreateApiKey()
const updateMutation = useUpdateApiKey()
const deleteMutation = useDeleteApiKey()

// ---- 创建 / 编辑 / 创建结果（单对话框多模式，避免双弹窗动画重叠闪烁） ----
const dialogVisible = ref(false)
const dialogMode = ref<'create' | 'edit' | 'result'>('create')
const dialogTitle = computed(() => {
  if (dialogMode.value === 'result') return '密钥创建成功'
  return dialogMode.value === 'create' ? '创建 API Key' : '编辑 API Key'
})
const editingId = ref('')
const form = ref<{
  provider: ProviderId
  name: string
  api_key: string
  model: string
  base_url: string
  is_active: boolean
}>({
  provider: 'openai',
  name: '',
  api_key: '',
  model: '',
  base_url: '',
  is_active: true,
})
const submitting = computed(
  () => createMutation.isPending.value || updateMutation.isPending.value,
)

function openCreate() {
  dialogMode.value = 'create'
  editingId.value = ''
  form.value = {
    provider: 'openai',
    name: '',
    api_key: '',
    model: '',
    base_url: '',
    is_active: true,
  }
  dialogVisible.value = true
}

function openEdit(row: ApiKey) {
  dialogMode.value = 'edit'
  editingId.value = row.id
  form.value = {
    provider: row.provider,
    name: row.name,
    api_key: '',
    model: row.model ?? '',
    base_url: row.base_url ?? '',
    is_active: row.is_active,
  }
  dialogVisible.value = true
}

async function handleSubmit() {
  if (!form.value.name.trim()) return
  if (dialogMode.value === 'create') {
    if (!form.value.api_key.trim()) return
    try {
      const key = await createMutation.mutateAsync({
        provider: form.value.provider,
        name: form.value.name.trim(),
        model: form.value.model.trim(),
        base_url: form.value.base_url.trim() || null,
        api_key: form.value.api_key.trim(),
      })
      dialogMode.value = 'result'
      resultKey.value = key
      copied.value = false
      ElMessage.success('API Key 创建成功')
    } catch (e) {
      ElMessage.error((e as Error).message || '创建失败')
    }
  } else {
    try {
      await updateMutation.mutateAsync({
        id: editingId.value,
        data: {
          provider: form.value.provider,
          name: form.value.name.trim(),
          model: form.value.model.trim(),
          base_url: form.value.base_url.trim() || null,
          is_active: form.value.is_active,
        },
      })
      dialogVisible.value = false
      ElMessage.success('API Key 已更新')
    } catch (e) {
      ElMessage.error((e as Error).message || '更新失败')
    }
  }
}

// ---- 行内启停 ----
const toggleId = ref('')

async function handleToggle(row: ApiKey, val: boolean) {
  toggleId.value = row.id
  try {
    await updateMutation.mutateAsync({
      id: row.id,
      data: {
        provider: row.provider,
        name: row.name,
        model: row.model,
        base_url: row.base_url ?? null,
        is_active: val,
      },
    })
    ElMessage.success(val ? '已启用' : '已停用')
  } catch (e) {
    ElMessage.error((e as Error).message || '操作失败')
  } finally {
    toggleId.value = ''
  }
}

// ---- 创建结果（完整密钥仅展示一次） ----
const resultKey = ref<ApiKeyCreateResult | null>(null)
const copied = ref(false)

async function copyKey() {
  if (!resultKey.value) return
  try {
    await navigator.clipboard.writeText(resultKey.value.api_key)
    copied.value = true
    setTimeout(() => (copied.value = false), 2000)
  } catch {
    ElMessage.error('复制失败，请手动选中复制')
  }
}

function closeResult() {
  dialogVisible.value = false
  resultKey.value = null
  copied.value = false
}

// ---- 删除 ----
function handleDelete(id: string) {
  deleteMutation.mutate(id, {
    onSuccess: () => ElMessage.success('API Key 已删除'),
    onError: (e) => ElMessage.error((e as Error).message || '删除失败'),
  })
}
</script>

<template>
  <div>
    <!-- Hero -->
    <div class="mb-6 flex items-center justify-between">
      <div class="flex items-center gap-3">
        <div
          class="flex h-10 w-10 items-center justify-center rounded-xl shrink-0"
          style="background: var(--brand-gradient); box-shadow: 0 8px 20px -8px color-mix(in oklch, var(--accent) 55%, transparent)"
        >
          <el-icon
            :size="18"
            color="#fff"
          >
            <Key />
          </el-icon>
        </div>
        <div>
          <h1
            class="font-display text-2xl font-bold tracking-tight"
            style="color: var(--foreground)"
          >
            API Keys
          </h1>
          <p
            class="mt-0.5 text-xs"
            style="color: var(--foreground); opacity: 0.55"
          >
            集中管理各 Provider 的访问凭证
          </p>
        </div>
      </div>
      <el-button
        type="primary"
        :icon="Plus"
        @click="openCreate"
      >
        创建 API Key
      </el-button>
    </div>

    <!-- 安全提示 -->
    <div
      class="mb-6 flex items-center gap-3 rounded-xl border px-4 py-3 text-sm"
      style="
        border-color: color-mix(in oklch, var(--el-color-warning) 35%, var(--border));
        background: color-mix(in oklch, var(--el-color-warning) 7%, transparent);
      "
    >
      <el-icon
        :size="16"
        style="color: var(--el-color-warning)"
      >
        <WarningFilled />
      </el-icon>
      <span style="color: var(--foreground)">
        密钥将以加密形式存储，仅在创建时完整展示一次，请立即复制并妥善保管；列表仅显示脱敏内容。
      </span>
    </div>

    <!-- 加载骨架 -->
    <div
      v-if="isLoading"
      class="flex flex-col gap-2"
    >
      <el-skeleton
        v-for="i in 4"
        :key="i"
        animated
      >
        <template #template>
          <div
            class="flex items-center gap-4 rounded-xl border p-4"
            style="border-color: var(--border)"
          >
            <el-skeleton-item
              variant="circle"
              style="width: 32px; height: 32px"
            />
            <div class="flex-1">
              <el-skeleton-item
                variant="h3"
                style="width: 30%"
              />
              <el-skeleton-item
                variant="text"
                style="width: 60%; margin-top: 8px"
              />
            </div>
          </div>
        </template>
      </el-skeleton>
    </div>

    <!-- 空状态 -->
    <el-empty
      v-else-if="!keys?.length"
      description="暂无 API Key"
    >
      <el-button
        type="primary"
        :icon="Plus"
        @click="openCreate"
      >
        创建第一个 API Key
      </el-button>
    </el-empty>

    <!-- 列表 -->
    <el-table
      v-else
      v-loading="deleteMutation.isPending.value"
      :data="keys"
    >
      <el-table-column
        label="Provider"
        width="120"
      >
        <template #default="{ row }">
          <el-tag
            size="small"
            effect="plain"
          >
            {{ row.provider }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column
        label="名称"
        min-width="160"
      >
        <template #default="{ row }">
          <span
            class="text-sm font-medium"
            style="color: var(--foreground)"
          >{{ row.name }}</span>
        </template>
      </el-table-column>
      <el-table-column
        label="默认模型"
        min-width="150"
      >
        <template #default="{ row }">
          <span
            v-if="row.model"
            class="text-xs font-mono"
            style="color: var(--foreground)"
          >{{ row.model }}</span>
          <span
            v-else
            class="text-xs"
            style="color: var(--foreground); opacity: 0.4"
          >—</span>
        </template>
      </el-table-column>
      <el-table-column
        label="密钥"
        min-width="200"
      >
        <template #default="{ row }">
          <code
            class="inline-flex items-center rounded-lg border px-2.5 py-1 font-mono text-xs"
            style="
              border-color: var(--border);
              background: var(--surface-secondary);
              color: var(--foreground);
            "
          >{{ row.api_key }}</code>
        </template>
      </el-table-column>
      <el-table-column
        label="端点"
        min-width="160"
      >
        <template #default="{ row }">
          <span
            v-if="row.base_url"
            class="block max-w-[160px] truncate font-mono text-xs"
            :title="row.base_url"
            style="color: var(--foreground)"
          >{{ row.base_url }}</span>
          <span
            v-else
            class="text-xs"
            style="color: var(--foreground); opacity: 0.4"
          >—</span>
        </template>
      </el-table-column>
      <el-table-column
        label="状态"
        width="80"
        align="center"
      >
        <template #default="{ row }">
          <el-switch
            :model-value="row.is_active"
            size="small"
            :loading="toggleId === row.id"
            @change="(val: boolean) => handleToggle(row, val)"
          />
        </template>
      </el-table-column>
      <el-table-column
        label="创建时间"
        width="170"
      >
        <template #default="{ row }">
          <span
            class="text-xs"
            style="color: var(--foreground)"
          >{{ formatDate(row.created_at) }}</span>
        </template>
      </el-table-column>
      <el-table-column
        label="操作"
        width="96"
        fixed="right"
        align="center"
      >
        <template #default="{ row }">
          <div class="ops-group flex items-center justify-center">
            <el-tooltip content="编辑">
              <el-button
                text
                aria-label="编辑"
                @click="openEdit(row)"
              >
                <el-icon :size="16">
                  <Edit />
                </el-icon>
              </el-button>
            </el-tooltip>
            <el-popconfirm
              :title="`确定删除 API Key「${row.name}」？删除后立即失效，无法恢复`"
              width="280"
              confirm-button-text="删除"
              cancel-button-text="取消"
              confirm-button-type="danger"
              @confirm="handleDelete(row.id)"
            >
              <template #reference>
                <el-button
                  type="danger"
                  text
                  aria-label="删除"
                >
                  <el-icon :size="16">
                    <Delete />
                  </el-icon>
                </el-button>
              </template>
            </el-popconfirm>
          </div>
        </template>
      </el-table-column>
    </el-table>

    <!-- 创建 / 编辑 / 创建结果（单对话框：成功时不关闭，直接切换内容，避免闪一下） -->
    <el-dialog
      v-model="dialogVisible"
      :title="dialogTitle"
      :width="dialogMode === 'result' ? '520px' : '480px'"
      :show-close="dialogMode !== 'result'"
      :close-on-click-modal="dialogMode !== 'result'"
      :close-on-press-escape="dialogMode !== 'result'"
    >
      <!-- 双面板 Grid 堆叠：切换时容器高度恒定，交叉淡入淡出避免突变闪烁 -->
      <div class="dialog-panes">
        <el-form
          class="dialog-pane"
          :class="{ 'pane-hidden': dialogMode === 'result' }"
          label-position="top"
        >
          <el-form-item label="Provider">
            <el-select
              v-model="form.provider"
              style="width: 100%"
            >
              <el-option
                v-for="p in PROVIDERS"
                :key="p.value"
                :label="p.label"
                :value="p.value"
              />
            </el-select>
          </el-form-item>
          <el-form-item label="名称">
            <el-input
              v-model="form.name"
              placeholder="例如：生产环境 / 本地开发"
              maxlength="256"
              show-word-limit
            />
          </el-form-item>
          <el-form-item
            v-if="dialogMode === 'create'"
            label="密钥"
          >
            <el-input
              v-model="form.api_key"
              type="password"
              show-password
              placeholder="粘贴该 Provider 的 API Key"
            />
          </el-form-item>
          <el-form-item label="默认模型（可选）">
            <el-input
              v-model="form.model"
              placeholder="如 gpt-4o / deepseek-chat"
              maxlength="128"
            />
          </el-form-item>
          <el-form-item label="自定义端点（可选）">
            <el-input
              v-model="form.base_url"
              placeholder="如 https://api.openai.com/v1（代理场景）"
              maxlength="512"
            />
          </el-form-item>
          <el-form-item
            v-if="dialogMode === 'edit'"
            label="状态"
          >
            <div class="flex items-center gap-3">
              <el-switch v-model="form.is_active" />
              <span
                class="text-xs"
                style="color: var(--foreground); opacity: 0.55"
              >停用后该密钥将无法使用</span>
            </div>
          </el-form-item>
          <div
            v-if="dialogMode === 'edit'"
            class="rounded-lg border px-3 py-2 text-xs"
            style="
            border-color: var(--border);
            background: var(--surface-secondary);
            color: var(--foreground);
            opacity: 0.7;
          "
          >
            密钥为加密存储，编辑不会修改；如需更换请删除后重新创建。
          </div>
        </el-form>

        <!-- 创建成功：完整密钥仅展示一次 -->
        <div
          class="dialog-pane"
          :class="{ 'pane-hidden': dialogMode !== 'result' }"
        >
          <div
            class="mb-4 flex items-start gap-2 rounded-lg border px-3 py-2.5 text-sm"
            style="
              border-color: color-mix(in oklch, var(--el-color-warning) 35%, var(--border));
              background: color-mix(in oklch, var(--el-color-warning) 7%, transparent);
            "
          >
            <el-icon
              :size="15"
              style="color: var(--el-color-warning); margin-top: 2px"
            >
              <WarningFilled />
            </el-icon>
            <span style="color: var(--foreground); opacity: 0.8">
              请立即复制并妥善保管。关闭此窗口后，完整密钥将不再显示。
            </span>
          </div>
          <div
            class="relative rounded-xl border p-5 pt-5"
            style="
              border-color: color-mix(in oklch, var(--el-color-warning) 35%, var(--border));
              background: var(--surface-secondary);
            "
          >
            <span
              class="absolute -top-2 left-4 rounded px-1.5 py-0.5 text-[10px] font-medium"
              style="
                background: var(--surface);
                color: var(--el-color-warning);
                border: 1px solid color-mix(in oklch, var(--el-color-warning) 35%, var(--border));
              "
            >完整密钥</span>
            <div
              class="mb-2 text-xs"
              style="color: var(--foreground); opacity: 0.5"
            >
              {{ PROVIDERS.find(p => p.value === form.provider)?.label ?? form.provider }} · {{ form.name }}
            </div>
            <code
              class="block break-all font-mono text-sm leading-relaxed"
              style="color: var(--foreground)"
            >{{ resultKey?.api_key }}</code>
          </div>
          <p
            class="mt-3 text-xs"
            style="color: var(--foreground); opacity: 0.45"
          >
            密钥已加密存储，可在 API Key 列表中随时停用或删除。
          </p>
        </div>
      </div>
      <template #footer>
        <template v-if="dialogMode === 'result'">
          <el-button @click="closeResult">
            完成
          </el-button>
          <el-button
            :type="copied ? 'success' : 'primary'"
            :icon="copied ? Check : CopyDocument"
            @click="copyKey"
          >
            {{ copied ? '已复制' : '复制密钥' }}
          </el-button>
        </template>
        <template v-else>
          <el-button @click="dialogVisible = false">
            取消
          </el-button>
          <el-button
            type="primary"
            :loading="submitting"
            :disabled="!form.name.trim() || (dialogMode === 'create' && !form.api_key.trim())"
            @click="handleSubmit"
          >
            {{ dialogMode === 'create' ? '创建' : '保存' }}
          </el-button>
        </template>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
/* 操作列按钮紧凑排列（覆盖 el-button 相邻 margin-left） */
.ops-group :deep(.el-button + .el-button) {
  margin-left: 4px;
}

/* 对话框双面板：Grid 同格堆叠，高度取两者最大值，切换零突变 */
.dialog-panes {
  display: grid;
}
.dialog-panes > .dialog-pane {
  grid-area: 1 / 1;
  transition: opacity 0.15s ease;
}
.dialog-panes > .dialog-pane.pane-hidden {
  opacity: 0;
  visibility: hidden;
  pointer-events: none;
  transition: opacity 0.15s ease, visibility 0s linear 0.15s;
}
/* 结果面板补足高度：与创建模式表单高度（400px）一致，切换时容器零塌缩 */
.dialog-panes > .dialog-pane:last-child {
  min-height: 400px;
  display: flex;
  flex-direction: column;
  justify-content: center;
}
</style>
