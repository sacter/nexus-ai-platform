<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import type { FormInstance, FormRules } from 'element-plus'
import { ArrowLeft, Plus, Delete } from '@element-plus/icons-vue'
import {
  useAiApplication,
  useCreateAiApplication,
  useUpdateAiApplication,
} from '@/modules/ai-application/composables/useAiApplications'
import { useKnowledgeBases } from '@/modules/knowledge/composables/useKnowledge'
import { useWorkflows } from '@/modules/workflow/composables/useWorkflow'
import { useModels } from '@/modules/models/composables/useModels'
import { usePromptTemplates } from '@/modules/prompt/composables/usePrompts'
import { useTools } from '@/modules/tools/composables/useTools'
import {
  APP_ICONS,
  type AiApplication,
} from '@/modules/ai-application/types/ai-application'
import type { KnowledgeBase } from '@/modules/knowledge/types/knowledge'
import type { PromptTemplate } from '@/modules/prompt/types/prompt'
import {
  buildAppPayload,
  emptyAppForm,
  formFromApp,
} from '@/modules/ai-application/utils/app-payload'

/** 后端 workflow/tool 列表行（前端 types 仍是 stub，先按实际返回声明最小形状） */
interface WorkflowOption {
  id: string
  name: string
  type: string
  isActive?: boolean
}
interface ToolOption {
  id: string
  name: string
  displayName?: string
  type: string
  description?: string | null
  isActive?: boolean
}

const route = useRoute()
const router = useRouter()
const appId = computed(() => String(route.params.appId ?? ''))
const isEdit = computed(() => !!appId.value)

const { data: existing, isLoading: loadingExisting } = useAiApplication(appId)
const createMutation = useCreateAiApplication()
const updateMutation = useUpdateAiApplication()

const { data: kbs } = useKnowledgeBases()
const { data: workflows } = useWorkflows()
const { data: models } = useModels()
const { data: prompts } = usePromptTemplates()
const { data: tools } = useTools()

const workflowOptions = computed(
  () => (workflows.value ?? []) as unknown as WorkflowOption[],
)
const toolOptions = computed(
  () => (tools.value ?? []) as unknown as ToolOption[],
)
// 上游 api 未标注泛型（返回 unknown），这里按真实契约收窄
const kbOptions = computed(() => (kbs.value ?? []) as KnowledgeBase[])
const promptOptions = computed(() => (prompts.value ?? []) as PromptTemplate[])
// 应用只能绑定对话模型（chat 会话用）
const chatModelOptions = computed(() =>
  (models.value ?? []).filter((m) => m.type === 'chat'),
)

const formRef = ref<FormInstance>()
const form = reactive(emptyAppForm())
const populated = ref(false)

// 编辑模式：详情到达后回填一次（用户开始编辑后不再覆盖）
watch(
  existing,
  (app) => {
    if (app && !populated.value) {
      Object.assign(form, formFromApp(app as AiApplication))
      populated.value = true
    }
  },
  { immediate: true },
)

const rules: FormRules = {
  name: [{ required: true, message: '请输入应用名称', trigger: 'blur' }],
  knowledgeBaseId: [
    { required: true, message: '请选择知识库', trigger: 'change' },
  ],
  workflowId: [{ required: true, message: '请选择工作流', trigger: 'change' }],
  modelId: [{ required: true, message: '请选择模型', trigger: 'change' }],
}

const submitting = computed(
  () => createMutation.isPending.value || updateMutation.isPending.value,
)

function addQuestion() {
  if (form.suggestedQuestions.length < 5) form.suggestedQuestions.push('')
}
function removeQuestion(index: number) {
  form.suggestedQuestions.splice(index, 1)
}

async function handleSubmit() {
  try {
    await formRef.value?.validate()
  } catch {
    return
  }
  const payload = buildAppPayload(form)
  try {
    if (isEdit.value) {
      await updateMutation.mutateAsync({ id: appId.value, data: payload })
      ElMessage.success('应用已保存')
      router.push(`/ai-applications/${appId.value}`)
    } else {
      const created = await createMutation.mutateAsync(payload)
      ElMessage.success('应用已创建，可前往详情页发布')
      router.push(`/ai-applications/${created.id}`)
    }
  } catch (e) {
    ElMessage.error((e as Error).message || '保存失败')
  }
}
</script>

<template>
  <div class="mx-auto">
    <div class="mb-6 flex items-center gap-3">
      <el-button
        text
        :icon="ArrowLeft"
        @click="router.back()"
      >
        返回
      </el-button>
      <h1
        class="font-display text-2xl font-bold tracking-tight"
        style="color: var(--foreground)"
      >
        {{ isEdit ? '编辑应用' : '创建应用' }}
      </h1>
    </div>

    <el-skeleton
      v-if="isEdit && loadingExisting"
      animated
      :rows="8"
    />

    <el-form
      v-else
      ref="formRef"
      :model="form"
      :rules="rules"
      label-position="top"
    >
      <!-- 基本信息 -->
      <el-card class="mb-4">
        <h2
          class="mb-4 text-sm font-semibold"
          style="color: var(--foreground)"
        >
          基本信息
        </h2>
        <el-form-item
          label="名称"
          prop="name"
        >
          <el-input
            v-model="form.name"
            maxlength="256"
            show-word-limit
            placeholder="例如：财务制度助手"
          />
        </el-form-item>
        <el-form-item label="描述">
          <el-input
            v-model="form.description"
            type="textarea"
            :rows="2"
            placeholder="这个应用帮谁解决什么问题"
          />
        </el-form-item>
        <el-form-item label="图标">
          <div class="flex flex-wrap gap-2">
            <button
              v-for="icon in APP_ICONS"
              :key="icon.value"
              type="button"
              :title="icon.label"
              class="icon-option flex h-11 w-11 items-center justify-center rounded-xl text-xl transition-transform"
              :class="{ 'icon-option--active': form.icon === icon.value }"
              @click="form.icon = icon.value"
            >
              {{ icon.glyph }}
            </button>
          </div>
        </el-form-item>
      </el-card>

      <!-- 绑定资源 -->
      <el-card class="mb-4">
        <h2
          class="mb-1 text-sm font-semibold"
          style="color: var(--foreground)"
        >
          绑定资源
        </h2>
        <p
          class="mb-4 text-xs"
          style="color: var(--foreground); opacity: 0.55"
        >
          应用启动对话时自动使用这套装配，无需每次手动选择
        </p>
        <div class="grid grid-cols-1 gap-x-4 md:grid-cols-2">
          <el-form-item
            label="知识库"
            prop="knowledgeBaseId"
          >
            <el-select
              v-model="form.knowledgeBaseId"
              placeholder="选择知识库"
              filterable
              class="w-full"
            >
              <el-option
                v-for="kb in kbOptions"
                :key="kb.id"
                :label="kb.name"
                :value="kb.id"
              />
            </el-select>
          </el-form-item>
          <el-form-item
            label="工作流"
            prop="workflowId"
          >
            <el-select
              v-model="form.workflowId"
              placeholder="选择工作流"
              filterable
              class="w-full"
            >
              <el-option
                v-for="wf in workflowOptions"
                :key="wf.id"
                :label="`${wf.name}（${wf.type}）`"
                :value="wf.id"
              />
            </el-select>
          </el-form-item>
          <el-form-item
            label="对话模型"
            prop="modelId"
          >
            <el-select
              v-model="form.modelId"
              placeholder="选择 chat 类型模型"
              filterable
              class="w-full"
            >
              <el-option
                v-for="m in chatModelOptions"
                :key="m.id"
                :label="`${m.displayName}（${m.provider}）`"
                :value="m.id"
              />
            </el-select>
          </el-form-item>
          <el-form-item label="Prompt 模板">
            <el-select
              v-model="form.promptTemplateId"
              placeholder="系统默认"
              clearable
              filterable
              class="w-full"
            >
              <el-option
                v-for="p in promptOptions"
                :key="p.id"
                :label="p.name"
                :value="p.id"
              />
            </el-select>
          </el-form-item>
        </div>
      </el-card>

      <!-- 运行配置 -->
      <el-card class="mb-4">
        <h2
          class="mb-4 text-sm font-semibold"
          style="color: var(--foreground)"
        >
          运行配置
        </h2>
        <div class="grid grid-cols-1 gap-x-4 md:grid-cols-2">
          <el-form-item :label="`随机性 temperature：${form.temperature.toFixed(1)}`">
            <el-slider
              v-model="form.temperature"
              :min="0"
              :max="2"
              :step="0.1"
            />
          </el-form-item>
          <el-form-item label="最大输出 maxTokens">
            <el-input-number
              v-model="form.maxTokens"
              :min="1"
              :max="128000"
              :step="512"
              class="w-full"
            />
          </el-form-item>
        </div>
        <el-form-item label="欢迎语">
          <el-input
            v-model="form.welcomeMessage"
            type="textarea"
            :rows="2"
            placeholder="会话开场白，例如：你好！我是财务助手，可以解答报销、请假等制度问题"
          />
        </el-form-item>
        <el-form-item label="建议问题">
          <div class="flex w-full flex-col gap-2">
            <div
              v-for="(q, i) in form.suggestedQuestions"
              :key="i"
              class="flex items-center gap-2"
            >
              <el-input
                v-model="form.suggestedQuestions[i]"
                placeholder="例如：报销需要什么材料？"
              />
              <el-button
                text
                type="danger"
                :icon="Delete"
                aria-label="删除建议问题"
                @click="removeQuestion(i)"
              />
            </div>
            <el-button
              v-if="form.suggestedQuestions.length < 5"
              text
              :icon="Plus"
              class="self-start"
              @click="addQuestion"
            >
              添加建议问题
            </el-button>
          </div>
        </el-form-item>
      </el-card>

      <!-- 工具 -->
      <el-card class="mb-4">
        <h2
          class="mb-1 text-sm font-semibold"
          style="color: var(--foreground)"
        >
          工具
        </h2>
        <p
          class="mb-4 text-xs"
          style="color: var(--foreground); opacity: 0.55"
        >
          绑定后，该应用发起的会话自动挂载这些工具
        </p>
        <el-empty
          v-if="!toolOptions.length"
          description="暂无可用工具"
          :image-size="60"
        />
        <el-checkbox-group
          v-else
          v-model="form.toolIds"
          class="w-full"
        >
          <div class="grid grid-cols-1 gap-2 md:grid-cols-2">
            <el-checkbox
              v-for="tool in toolOptions"
              :key="tool.id"
              :value="tool.id"
              class="tool-checkbox !mr-0 !h-auto"
            >
              <div class="flex items-center gap-2">
                <span
                  class="text-sm"
                  style="color: var(--foreground)"
                >
                  {{ tool.displayName || tool.name }}
                </span>
                <el-tag
                  size="small"
                  effect="plain"
                >
                  {{ tool.type }}
                </el-tag>
              </div>
              <div
                v-if="tool.description"
                class="mt-0.5 text-xs line-clamp-1"
                style="color: var(--foreground); opacity: 0.5"
              >
                {{ tool.description }}
              </div>
            </el-checkbox>
          </div>
        </el-checkbox-group>
      </el-card>

      <div class="flex justify-end gap-3 pb-6">
        <el-button @click="router.back()">
          取消
        </el-button>
        <el-button
          type="primary"
          :loading="submitting"
          @click="handleSubmit"
        >
          {{ isEdit ? '保存' : '创建应用' }}
        </el-button>
      </div>
    </el-form>
  </div>
</template>

<style scoped>
.icon-option {
  background: var(--surface-secondary);
  border: 1px solid var(--border);
  cursor: pointer;
}
.icon-option:hover {
  transform: translateY(-1px);
}
.icon-option--active {
  border-color: var(--accent);
  box-shadow: 0 0 0 2px color-mix(in oklch, var(--accent) 30%, transparent);
}
.tool-checkbox {
  align-items: flex-start;
  padding: 10px 12px;
  border: 1px solid var(--border);
  border-radius: 10px;
  background: var(--surface-secondary);
}
</style>
