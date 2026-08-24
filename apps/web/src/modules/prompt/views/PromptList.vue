<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import type { FormInstance, FormRules } from 'element-plus'
import {
  Clock,
  CopyDocument,
  Delete,
  EditPen,
  Files,
  Plus,
  Search,
  View,
} from '@element-plus/icons-vue'
import {
  useCreatePromptTemplate,
  useDeletePromptTemplate,
  usePromptTemplate,
  usePromptTemplates,
  usePromptVersions,
  useUpdatePromptTemplate,
} from '../composables/usePrompts'
import type { PromptTemplateRow } from '../types/prompt'
import {
  buildPromptPayload,
  emptyPromptForm,
  extractVariables,
} from '../utils/prompt-variables'
import PromptEditor from '../components/PromptEditor.vue'
import { formatDate } from '@/utils/format'

const { data: prompts, isLoading } = usePromptTemplates()
const createMutation = useCreatePromptTemplate()
const updateMutation = useUpdatePromptTemplate()
const deleteMutation = useDeletePromptTemplate()

const search = ref('')
const selectedId = ref('')
const editorVisible = ref(false)
const versionVisible = ref(false)
const editorMode = ref<'create' | 'edit'>('create')
const detailId = ref('')
/** 编辑时快照的版本号，用于保存后判定是否生成了新版本 */
const baselineVersion = ref<number | null>(null)
const formRef = ref<FormInstance>()
const form = reactive(emptyPromptForm())

const { data: detail } = usePromptTemplate(detailId)
const { data: versions, isLoading: versionsLoading } = usePromptVersions(selectedId)

const rows = computed(() => (prompts.value ?? []) as PromptTemplateRow[])
const filteredRows = computed(() => {
  const q = search.value.trim().toLowerCase()
  if (!q) return rows.value
  return rows.value.filter((p) =>
    [p.name, p.description ?? '', p.content ?? '', ...p.variables]
      .join(' ')
      .toLowerCase()
      .includes(q),
  )
})
const selected = computed(() => rows.value.find((p) => p.id === selectedId.value))
const liveVariables = computed(() => extractVariables(form.content))
const saving = computed(() => createMutation.isPending.value || updateMutation.isPending.value)

const rules: FormRules = {
  name: [{ required: true, message: '请输入模板名称', trigger: 'blur' }],
  content: [{ required: true, message: '请输入提示词正文', trigger: 'blur' }],
}

watch(detail, (value) => {
  if (value && editorMode.value === 'edit') {
    form.name = value.name
    form.description = value.description ?? ''
    form.content = value.content ?? ''
  }
})

function resetForm() {
  Object.assign(form, emptyPromptForm())
  formRef.value?.clearValidate()
}

function openCreate() {
  editorMode.value = 'create'
  detailId.value = ''
  baselineVersion.value = null
  resetForm()
  editorVisible.value = true
}

function openEdit(row: PromptTemplateRow) {
  editorMode.value = 'edit'
  detailId.value = row.id
  baselineVersion.value = row.currentVersionNumber
  form.name = row.name
  form.description = row.description ?? ''
  form.content = row.content ?? ''
  editorVisible.value = true
}

async function save() {
  try {
    await formRef.value?.validate()
  } catch {
    return
  }
  try {
    if (editorMode.value === 'create') {
      const created = await createMutation.mutateAsync(buildPromptPayload(form))
      ElMessage.success('提示词已创建，初始版本为 v1')
      selectedId.value = created.id
    } else {
      const next = await updateMutation.mutateAsync({
        id: detailId.value,
        data: buildPromptPayload(form),
      })
      ElMessage.success(
        next.currentVersionNumber && next.currentVersionNumber > (baselineVersion.value ?? 0)
          ? `已保存为 v${next.currentVersionNumber}`
          : '模板信息已保存',
      )
      selectedId.value = next.id
    }
    editorVisible.value = false
  } catch (e) {
    ElMessage.error((e as Error).message || '保存失败')
  }
}

async function remove(row: PromptTemplateRow) {
  try {
    await ElMessageBox.confirm(
      `删除「${row.name}」及其 ${row.versionCount} 个版本？已绑定的 AI 应用会自动解除提示词引用。`,
      '删除提示词模板',
      { confirmButtonText: '删除', cancelButtonText: '取消', type: 'warning' },
    )
    await deleteMutation.mutateAsync(row.id)
    if (selectedId.value === row.id) selectedId.value = ''
    ElMessage.success('提示词已删除')
  } catch (e) {
    if (e !== 'cancel' && e !== 'close') ElMessage.error((e as Error).message || '删除失败')
  }
}

function showVersions(row: PromptTemplateRow) {
  selectedId.value = row.id
  versionVisible.value = true
}

async function copyContent(content: string) {
  try {
    await navigator.clipboard.writeText(content)
    ElMessage.success('正文已复制')
  } catch {
    ElMessage.error('复制失败，请检查浏览器权限')
  }
}

function useVersion(content: string) {
  versionVisible.value = false
  editorMode.value = 'edit'
  detailId.value = selectedId.value
  baselineVersion.value = selected.value?.currentVersionNumber ?? null
  form.name = selected.value?.name ?? ''
  form.description = selected.value?.description ?? ''
  form.content = content
  editorVisible.value = true
  ElMessage.info('已载入历史正文，保存后会生成新的版本')
}
</script>

<template>
  <div class="prompt-workbench">
    <div class="mb-6 flex flex-wrap items-start justify-between gap-4">
      <div class="flex items-start gap-3">
        <div class="prompt-mark flex h-11 w-11 shrink-0 items-center justify-center rounded-xl">
          <el-icon :size="20">
            <EditPen />
          </el-icon>
        </div>
        <div>
          <div class="flex items-center gap-2">
            <h1
              class="font-display text-2xl font-bold tracking-tight"
              style="color: var(--foreground)"
            >
              提示词工作台
            </h1>
            <el-tag
              size="small"
              effect="plain"
            >
              {{ rows.length }} 个模板
            </el-tag>
          </div>
          <p
            class="mt-1 text-xs"
            style="color: var(--foreground); opacity: 0.55"
          >
            把可复用的思考方式保存成版本化模板
          </p>
        </div>
      </div>
      <el-button
        type="primary"
        :icon="Plus"
        @click="openCreate"
      >
        新建提示词
      </el-button>
    </div>

    <div class="mb-4 flex flex-wrap items-center gap-3">
      <el-input
        v-model="search"
        clearable
        :prefix-icon="Search"
        placeholder="搜索名称、正文或变量"
        class="max-w-sm"
      />
      <span
        class="text-xs"
        style="color: var(--foreground); opacity: 0.5"
      >
        {{ filteredRows.length }} / {{ rows.length }} 个模板
      </span>
    </div>

    <el-skeleton
      v-if="isLoading"
      animated
      :rows="7"
    />
    <div
      v-else-if="filteredRows.length"
      class="prompt-grid"
    >
      <article
        v-for="row in filteredRows"
        :key="row.id"
        class="prompt-sheet group"
        :class="{ 'prompt-sheet--selected': selectedId === row.id }"
        @click="selectedId = row.id"
      >
        <div class="prompt-sheet__rule" />
        <div class="flex items-start justify-between gap-3">
          <div class="min-w-0">
            <div class="flex items-center gap-2">
              <h2
                class="truncate text-base font-semibold"
                style="color: var(--foreground)"
              >
                {{ row.name }}
              </h2>
              <el-tag
                size="small"
                type="success"
                effect="plain"
              >
                v{{ row.currentVersionNumber ?? 0 }}
              </el-tag>
            </div>
            <p
              class="mt-1 line-clamp-1 text-xs"
              style="color: var(--foreground); opacity: 0.52"
            >
              {{ row.description || '未添加说明' }}
            </p>
          </div>
          <el-dropdown
            trigger="click"
            @click.stop
          >
            <el-button
              text
              :icon="Files"
              aria-label="更多操作"
              @click.stop
            />
            <template #dropdown>
              <el-dropdown-menu>
                <el-dropdown-item
                  :icon="EditPen"
                  @click="openEdit(row)"
                >
                  编辑模板
                </el-dropdown-item>
                <el-dropdown-item
                  :icon="Clock"
                  @click="showVersions(row)"
                >
                  查看版本
                </el-dropdown-item>
                <el-dropdown-item
                  :icon="Delete"
                  divided
                  @click="remove(row)"
                >
                  删除模板
                </el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>
        </div>

        <div class="prompt-preview mt-4">
          {{ row.content || '还没有正文' }}
        </div>

        <div class="mt-4 flex min-h-6 flex-wrap items-center gap-1.5">
          <span
            class="text-[10px] uppercase tracking-wider"
            style="color: var(--foreground); opacity: 0.42"
          >Variables</span>
          <el-tag
            v-for="variable in row.variables"
            :key="variable"
            size="small"
            effect="plain"
          >
            {{ variable }}
          </el-tag>
          <span
            v-if="!row.variables.length"
            class="text-xs"
            style="color: var(--foreground); opacity: 0.42"
          >无动态变量</span>
        </div>
        <div
          class="mt-4 flex items-center justify-between border-t pt-3 text-[11px]"
          style="border-color: var(--border); color: var(--foreground); opacity: 0.52"
        >
          <button
            class="inline-flex items-center gap-1 hover:opacity-100"
            type="button"
            @click.stop="showVersions(row)"
          >
            <el-icon :size="13">
              <Clock />
            </el-icon>{{ row.versionCount }} 个版本
          </button>
          <span>{{ formatDate(row.updatedAt) }}</span>
        </div>
      </article>
    </div>
    <el-empty
      v-else
      :description="search ? '没有匹配的提示词' : '还没有提示词模板'"
    >
      <el-button
        v-if="!search"
        type="primary"
        :icon="Plus"
        @click="openCreate"
      >
        创建第一个模板
      </el-button>
    </el-empty>

    <!-- 编辑器：左侧正文，右侧变量/使用说明，像一张可审阅的提示词稿纸 -->
    <el-dialog
      v-model="editorVisible"
      :title="editorMode === 'create' ? '新建提示词' : '编辑提示词'"
      width="min(920px, 94vw)"
      destroy-on-close
    >
      <el-form
        ref="formRef"
        :model="form"
        :rules="rules"
        label-position="top"
        @submit.prevent="save"
      >
        <div class="editor-layout">
          <div>
            <el-form-item
              label="模板名称"
              prop="name"
            >
              <el-input
                v-model="form.name"
                maxlength="256"
                show-word-limit
                placeholder="例如：严谨的知识库问答"
              />
            </el-form-item>
            <el-form-item label="用途说明">
              <el-input
                v-model="form.description"
                type="textarea"
                :rows="2"
                placeholder="这个模板在什么场景下使用"
              />
            </el-form-item>
            <el-form-item
              label="提示词正文"
              prop="content"
            >
              <PromptEditor
                v-model="form.content"
                :rows="16"
                placeholder="You are a precise assistant...&#10;&#10;Context:&#10;{{context}}&#10;&#10;Question:&#10;{{question}}"
              />
            </el-form-item>
          </div>
          <aside class="variable-panel">
            <div class="variable-panel__eyebrow">
              PROMPT SURFACE
            </div>
            <h3
              class="mt-1 text-sm font-semibold"
              style="color: var(--foreground)"
            >
              动态变量
            </h3>
            <p
              class="mt-1 text-xs leading-5"
              style="color: var(--foreground); opacity: 0.55"
            >
              使用双大括号注入会话上下文。正文变更后保存，会留下一个可追溯的新版本。
            </p>
            <div class="mt-4 flex flex-wrap gap-1.5">
              <el-tag
                v-for="variable in liveVariables"
                :key="variable"
                type="warning"
                effect="light"
              >
                {{ variable }}
              </el-tag>
              <span
                v-if="!liveVariables.length"
                class="text-xs"
                style="color: var(--foreground); opacity: 0.45"
              >输入 &#123;&#123;变量名&#125;&#125; 声明动态变量</span>
            </div>
            <div
              class="mt-5 border-t pt-4 text-xs"
              style="border-color: var(--border); color: var(--foreground); opacity: 0.5"
            >
              {{ form.content.length }} 字符 · {{ liveVariables.length }} 个变量
            </div>
          </aside>
        </div>
      </el-form>
      <template #footer>
        <el-button @click="editorVisible = false">
          取消
        </el-button>
        <el-button
          type="primary"
          :loading="saving"
          @click="save"
        >
          {{ editorMode === 'create' ? '创建模板' : '保存' }}
        </el-button>
      </template>
    </el-dialog>

    <el-drawer
      v-model="versionVisible"
      title="版本时间轴"
      size="min(520px, 92vw)"
    >
      <div
        v-if="selected"
        class="mb-5"
      >
        <div class="flex items-center gap-2">
          <span
            class="text-lg font-semibold"
            style="color: var(--foreground)"
          >{{ selected.name }}</span>
          <el-tag
            type="success"
            size="small"
          >
            当前 v{{ selected.currentVersionNumber }}
          </el-tag>
        </div>
        <p
          class="mt-1 text-xs"
          style="color: var(--foreground); opacity: 0.5"
        >
          每次正文变更都会保留一份历史稿
        </p>
      </div>
      <el-skeleton
        v-if="versionsLoading"
        animated
        :rows="6"
      />
      <el-timeline v-else>
        <el-timeline-item
          v-for="version in versions ?? []"
          :key="version.id"
          :timestamp="formatDate(version.createdAt)"
          placement="top"
        >
          <div
            class="version-entry"
            :class="{ 'version-entry--current': version.id === selected?.currentVersionId }"
          >
            <div class="flex items-center justify-between gap-2">
              <div class="flex items-center gap-2">
                <span
                  class="font-semibold"
                  style="color: var(--foreground)"
                >v{{ version.versionNumber }}</span><el-tag
                  v-if="version.id === selected?.currentVersionId"
                  size="small"
                  type="success"
                >
                  当前
                </el-tag>
              </div>
              <div class="flex gap-1">
                <el-button
                  text
                  size="small"
                  :icon="View"
                  @click="useVersion(version.content)"
                >
                  载入
                </el-button><el-button
                  text
                  size="small"
                  :icon="CopyDocument"
                  aria-label="复制正文"
                  @click="copyContent(version.content)"
                />
              </div>
            </div>
            <p class="version-content mt-2">
              {{ version.content }}
            </p>
            <div class="mt-2 flex flex-wrap gap-1">
              <el-tag
                v-for="variable in version.variables"
                :key="variable"
                size="small"
                effect="plain"
              >
                {{ variable }}
              </el-tag>
            </div>
          </div>
        </el-timeline-item>
      </el-timeline>
      <el-empty
        v-if="!versionsLoading && !versions?.length"
        description="暂无版本"
      />
    </el-drawer>
  </div>
</template>

<style scoped>
.prompt-workbench {
  --paper-line: color-mix(in oklch, var(--accent) 22%, var(--border));
}
.prompt-mark {
  color: var(--accent-foreground, #fff);
  background: var(--brand-gradient);
  box-shadow: 0 10px 24px -12px color-mix(in oklch, var(--accent) 70%, transparent);
}
.prompt-grid {
  display: grid;
  grid-template-columns: repeat(1, minmax(0, 1fr));
  gap: 16px;
}
@media (min-width: 768px) {
  .prompt-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}
@media (min-width: 1280px) {
  .prompt-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); }
}
.prompt-sheet {
  position: relative;
  overflow: hidden;
  min-height: 264px;
  padding: 20px;
  cursor: pointer;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--surface);
  transition: border-color 160ms ease, transform 160ms ease, box-shadow 160ms ease;
}
.prompt-sheet:hover,
.prompt-sheet--selected {
  border-color: color-mix(in oklch, var(--accent) 55%, var(--border));
  box-shadow: 0 12px 28px -20px color-mix(in oklch, var(--accent) 60%, transparent);
  transform: translateY(-2px);
}
.prompt-sheet__rule {
  position: absolute;
  top: 0;
  left: 0;
  width: 5px;
  height: 100%;
  background: var(--paper-line);
}
.prompt-preview,
.version-content {
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
}
.prompt-preview {
  display: -webkit-box;
  min-height: 74px;
  overflow: hidden;
  color: var(--foreground);
  opacity: 0.72;
  font-size: 12px;
  line-height: 1.65;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 4;
}
.editor-layout {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 220px;
  gap: 20px;
}
.variable-panel {
  align-self: start;
  padding: 16px;
  border-left: 1px solid var(--border);
  background: color-mix(in oklch, var(--surface-secondary) 55%, transparent);
}
.variable-panel__eyebrow {
  color: var(--accent);
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.14em;
}
.version-entry {
  padding: 12px;
  border: 1px solid var(--border);
  border-radius: 6px;
  background: var(--surface-secondary);
}
.version-entry--current { border-color: color-mix(in oklch, var(--accent) 45%, var(--border)); }
.version-content {
  max-height: 130px;
  overflow: hidden;
  color: var(--foreground);
  opacity: 0.62;
  font-size: 11px;
  line-height: 1.55;
}
@media (max-width: 640px) {
  .editor-layout { grid-template-columns: 1fr; }
  .variable-panel { border-top: 1px solid var(--border); border-left: 0; }
}
@media (prefers-reduced-motion: reduce) {
  .prompt-sheet { transition: none; }
}
</style>
