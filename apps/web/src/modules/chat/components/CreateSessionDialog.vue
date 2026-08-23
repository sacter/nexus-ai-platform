<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { ElMessage, type FormInstance, type FormRules } from 'element-plus'
import { DEFAULT_WORKFLOW_TYPE, type WorkflowType } from '@nexus/config'
import { useKnowledgeBases } from '@/modules/knowledge/composables/useKnowledge'
import { usePromptTemplates } from '@/modules/prompt/composables/usePrompts'
import { useAiApplications } from '@/modules/ai-application/composables/useAiApplications'
import { useWorkflows } from '@/modules/workflow/composables/useWorkflow'
import { useModels } from '@/modules/models/composables/useModels'
import { useTools } from '@/modules/tools/composables/useTools'
import { useCreateChatSession } from '../composables/useChat'
import type { ChatSession } from '../types/chat'
import type { CreateSessionPayload } from '../api/chat.api'

const visible = defineModel<boolean>('visible', { default: false })
const props = defineProps<{ prefillTitle?: string }>()
const emit = defineEmits<{ (e: 'created', session: ChatSession): void }>()

// 后端列表返回结构未定，按最小结构收窄（id+name；workflow 多一个 type）
interface NamedOption { id: string; name: string }
interface WorkflowOption extends NamedOption { type: WorkflowType }

// 弹窗未打开时不请求选项源
const { data: kbsData, isError: kbsError, refetch: refetchKbs } = useKnowledgeBases(visible)
const { data: promptsData, isError: promptsError, refetch: refetchPrompts } = usePromptTemplates(visible)
const { data: appsData, isError: appsError, refetch: refetchApps } = useAiApplications(visible)
const { data: workflowsData, isError: workflowsError, refetch: refetchWorkflows } = useWorkflows(visible)
const { data: modelsData, isError: modelsError, refetch: refetchModels } = useModels(visible)
const { data: toolsData, isError: toolsError, refetch: refetchTools } = useTools(visible)

const knowledgeBases = computed(() => (kbsData.value ?? []) as NamedOption[])
const promptTemplates = computed(() => (promptsData.value ?? []) as NamedOption[])
const aiApplications = computed(() => (appsData.value ?? []) as NamedOption[])
// TODO(后端 workflow 模块落地后): 核对列表项 type 字段名与此处收窄一致，否则 workflowType 会静默回退 rag
const workflows = computed(() => (workflowsData.value ?? []) as WorkflowOption[])
// 模型下拉只列对话模型（embedding/rerank 不参与对话）
const chatModels = computed(() => (modelsData.value ?? []).filter((m) => m.type === 'chat'))
// tools 模块当前类型为 Stub{id}，label 暂用 id
const tools = computed(() => (toolsData.value ?? []) as { id: string }[])

const formRef = ref<FormInstance>()
// 创建方式：快捷模式 = 选 AI 应用（后端快照）；自定义模式 = 手动逐项选
type Mode = 'quick' | 'custom'
const mode = ref<Mode>('custom')
const form = reactive({
  title: '',
  aiApplicationId: '',
  kbId: '',
  promptTemplateId: '',
  modelId: '',
  workflowId: '',
  toolIds: [] as string[],
})

const rules: FormRules = {
  title: [
    { required: true, message: '请输入会话标题', trigger: 'blur' },
    { max: 512, message: '标题不能超过 512 字符', trigger: 'blur' },
  ],
}

const selectedWorkflow = computed(() => workflows.value.find((w) => w.id === form.workflowId))

const createMutation = useCreateChatSession()
const submitting = ref(false)

// 打开时重置表单并按 prefillTitle 预填；immediate 覆盖初始 visible=true 的挂载场景
watch(
  visible,
  (val) => {
    if (!val) return
    resetForm()
    formRef.value?.clearValidate()
  },
  { immediate: true },
)

// 模式切换时清空字段，避免跨模式残留
watch(mode, () => {
  resetForm()
  formRef.value?.clearValidate()
})

function resetForm() {
  form.title = props.prefillTitle ?? ''
  form.aiApplicationId = ''
  form.kbId = ''
  form.promptTemplateId = ''
  form.modelId = ''
  form.workflowId = ''
  form.toolIds = []
}

async function handleSubmit() {
  if (!formRef.value) return
  const valid = await formRef.value.validate().catch(() => false)
  if (!valid) return
  // 快捷模式必须选 AI 应用，否则后端会走自定义分支生成无法对话的空会话
  if (mode.value === 'quick' && !form.aiApplicationId) {
    ElMessage.warning('请选择 AI 应用')
    return
  }
  submitting.value = true
  try {
    const payload: CreateSessionPayload =
      mode.value === 'quick'
        ? { title: form.title, aiApplicationId: form.aiApplicationId, workflowType: DEFAULT_WORKFLOW_TYPE }
        : {
            title: form.title,
            ...(form.kbId ? { kbId: form.kbId } : {}),
            ...(form.promptTemplateId ? { promptTemplateId: form.promptTemplateId } : {}),
            ...(form.modelId ? { modelId: form.modelId } : {}),
            ...(form.workflowId ? { workflowId: form.workflowId } : {}),
            ...(form.toolIds.length ? { toolIds: form.toolIds } : {}),
            workflowType: selectedWorkflow.value?.type ?? DEFAULT_WORKFLOW_TYPE,
          }
    const session = await createMutation.mutateAsync(payload)
    visible.value = false
    emit('created', session)
  } catch {
    ElMessage.error('创建会话失败')
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <el-dialog
    v-model="visible"
    title="新建会话"
    width="560px"
  >
    <el-form
      ref="formRef"
      :model="form"
      :rules="rules"
      label-width="80px"
      @submit.prevent="handleSubmit"
    >
      <el-form-item
        label="标题"
        prop="title"
        required
      >
        <el-input
          v-model="form.title"
          placeholder="会话标题"
          maxlength="512"
        />
      </el-form-item>

      <el-form-item label="创建方式">
        <el-radio-group v-model="mode">
          <el-radio value="quick">
            快捷模式（AI 应用）
          </el-radio>
          <el-radio value="custom">
            自定义模式
          </el-radio>
        </el-radio-group>
      </el-form-item>

      <!-- 快捷模式：选 AI 应用，绑定（kb/workflow/model/prompt/tools）由后端快照到会话 -->
      <template v-if="mode === 'quick'">
        <el-form-item label="AI 应用">
          <el-select
            v-model="form.aiApplicationId"
            clearable
            filterable
            placeholder="选择 AI 应用"
            style="width: 100%"
          >
            <el-option
              v-for="app in aiApplications"
              :key="app.id"
              :label="app.name"
              :value="app.id"
            />
          </el-select>
          <p
            v-if="appsError"
            class="mt-1 text-xs"
            style="color: var(--el-color-error)"
          >
            AI 应用加载失败
            <el-button
              link
              type="primary"
              size="small"
              @click="refetchApps()"
            >
              重试
            </el-button>
          </p>
        </el-form-item>
      </template>

      <!-- 自定义模式：手动逐项选择 -->
      <template v-else>
        <el-form-item label="知识库">
          <el-select
            v-model="form.kbId"
            clearable
            filterable
            placeholder="选择知识库（可选）"
            style="width: 100%"
          >
            <el-option
              v-for="kb in knowledgeBases"
              :key="kb.id"
              :label="kb.name"
              :value="kb.id"
            />
          </el-select>
          <p
            v-if="kbsError"
            class="mt-1 text-xs"
            style="color: var(--el-color-error)"
          >
            知识库加载失败
            <el-button
              link
              type="primary"
              size="small"
              @click="refetchKbs()"
            >
              重试
            </el-button>
          </p>
        </el-form-item>

        <el-form-item label="提示词">
          <el-select
            v-model="form.promptTemplateId"
            clearable
            filterable
            placeholder="选择提示词模板（可选）"
            style="width: 100%"
          >
            <el-option
              v-for="pt in promptTemplates"
              :key="pt.id"
              :label="pt.name"
              :value="pt.id"
            />
          </el-select>
          <p
            v-if="promptsError"
            class="mt-1 text-xs"
            style="color: var(--el-color-error)"
          >
            提示词加载失败
            <el-button
              link
              type="primary"
              size="small"
              @click="refetchPrompts()"
            >
              重试
            </el-button>
          </p>
        </el-form-item>

        <el-form-item label="工作流">
          <el-select
            v-model="form.workflowId"
            clearable
            filterable
            placeholder="选择工作流（可选）"
            style="width: 100%"
          >
            <el-option
              v-for="wf in workflows"
              :key="wf.id"
              :label="`${wf.name}（${wf.type}）`"
              :value="wf.id"
            />
          </el-select>
          <p
            v-if="workflowsError"
            class="mt-1 text-xs"
            style="color: var(--el-color-error)"
          >
            工作流加载失败
            <el-button
              link
              type="primary"
              size="small"
              @click="refetchWorkflows()"
            >
              重试
            </el-button>
          </p>
        </el-form-item>

        <el-form-item label="模型">
          <el-select
            v-model="form.modelId"
            clearable
            filterable
            placeholder="选择对话模型（可选）"
            style="width: 100%"
          >
            <el-option
              v-for="m in chatModels"
              :key="m.id"
              :label="m.displayName"
              :value="m.id"
            />
          </el-select>
          <p
            v-if="modelsError"
            class="mt-1 text-xs"
            style="color: var(--el-color-error)"
          >
            模型加载失败
            <el-button
              link
              type="primary"
              size="small"
              @click="refetchModels()"
            >
              重试
            </el-button>
          </p>
        </el-form-item>

        <el-form-item label="工具">
          <el-select
            v-model="form.toolIds"
            multiple
            clearable
            placeholder="选择工具（可选）"
            style="width: 100%"
          >
            <el-option
              v-for="t in tools"
              :key="t.id"
              :label="t.id"
              :value="t.id"
            />
          </el-select>
          <p
            v-if="toolsError"
            class="mt-1 text-xs"
            style="color: var(--el-color-error)"
          >
            工具加载失败
            <el-button
              link
              type="primary"
              size="small"
              @click="refetchTools()"
            >
              重试
            </el-button>
          </p>
        </el-form-item>
      </template>
    </el-form>

    <template #footer>
      <el-button @click="visible = false">
        取消
      </el-button>
      <el-button
        type="primary"
        :loading="submitting"
        data-testid="create-session-submit"
        @click="handleSubmit"
      >
        创建
      </el-button>
    </template>
  </el-dialog>
</template>
