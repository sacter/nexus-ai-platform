<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { ElMessage, type FormInstance, type FormRules } from 'element-plus'
import { DEFAULT_WORKFLOW_TYPE, type WorkflowType } from '@nexus/config'
import { useKnowledgeBases } from '@/modules/knowledge/composables/useKnowledge'
import { usePromptTemplates } from '@/modules/prompt/composables/usePrompts'
import { useAiApplications } from '@/modules/ai-application/composables/useAiApplications'
import { useWorkflows } from '@/modules/workflow/composables/useWorkflow'
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

const knowledgeBases = computed(() => (kbsData.value ?? []) as NamedOption[])
const promptTemplates = computed(() => (promptsData.value ?? []) as NamedOption[])
const aiApplications = computed(() => (appsData.value ?? []) as NamedOption[])
// TODO(后端 workflow 模块落地后): 核对列表项 type 字段名与此处 WorkflowOption 收窄一致，否则 workflowType 会静默回退 rag
const workflows = computed(() => (workflowsData.value ?? []) as WorkflowOption[])

const formRef = ref<FormInstance>()
const form = reactive({
  title: '',
  aiApplicationId: '',
  kbId: '',
  promptTemplateId: '',
  workflowId: '',
})

const rules: FormRules = {
  title: [
    { required: true, message: '请输入会话标题', trigger: 'blur' },
    { max: 512, message: '标题不能超过 512 字符', trigger: 'blur' },
  ],
}

// AI 应用 = KB + Workflow + Model + Prompt 资源绑定（DATABASE.md 4.8），
// 选中后与手动选择互斥：清空并禁用下面三项
const appBound = computed(() => !!form.aiApplicationId)
watch(
  () => form.aiApplicationId,
  (v) => {
    if (v) {
      form.kbId = ''
      form.promptTemplateId = ''
      form.workflowId = ''
    }
  },
)

const selectedWorkflow = computed(() => workflows.value.find((w) => w.id === form.workflowId))

const createMutation = useCreateChatSession()
const submitting = ref(false)

// 打开时重置表单并按 prefillTitle 预填；immediate 覆盖初始 visible=true 的挂载场景
watch(
  visible,
  (val) => {
    if (!val) return
    form.title = props.prefillTitle ?? ''
    form.aiApplicationId = ''
    form.kbId = ''
    form.promptTemplateId = ''
    form.workflowId = ''
    formRef.value?.clearValidate()
  },
  { immediate: true },
)

async function handleSubmit() {
  if (!formRef.value) return
  const valid = await formRef.value.validate().catch(() => false)
  if (!valid) return
  submitting.value = true
  try {
    const payload: CreateSessionPayload = form.aiApplicationId
      ? { title: form.title, aiApplicationId: form.aiApplicationId, workflowType: DEFAULT_WORKFLOW_TYPE }
      : {
          title: form.title,
          ...(form.kbId ? { kbId: form.kbId } : {}),
          ...(form.promptTemplateId ? { promptTemplateId: form.promptTemplateId } : {}),
          ...(form.workflowId ? { workflowId: form.workflowId } : {}),
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
    width="520px"
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

      <el-form-item label="AI 应用">
        <el-select
          v-model="form.aiApplicationId"
          clearable
          filterable
          placeholder="选择 AI 应用（选中后无需再选下面三项）"
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

      <el-form-item label="知识库">
        <el-select
          v-model="form.kbId"
          :disabled="appBound"
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
          :disabled="appBound"
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
          :disabled="appBound"
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
