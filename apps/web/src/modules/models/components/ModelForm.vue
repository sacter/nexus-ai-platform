<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { ElMessage, type FormInstance, type FormRules } from 'element-plus'
import { ChatDotRound, DataLine, Key, Link, Sort } from '@element-plus/icons-vue'
import { useCreateModel, useUpdateModel } from '@/modules/models/composables/useModels'
import { useApiKeys } from '@/modules/api-keys/composables/useApiKeys'
import { MODEL_TYPES, PROVIDERS, MODEL_CONFIG_LIMITS, createDefaultConfig } from '@/modules/models/types/model'
import type {
  Model,
  ModelChatConfig,
  ModelConfig,
  ModelEmbeddingConfig,
  ModelProvider,
  ModelRerankConfig,
  ModelType,
} from '@/modules/models/types/model'

const visible = defineModel<boolean>('visible', { default: false })
const props = defineProps<{ model?: Model | null }>()
const emit = defineEmits<{ saved: [] }>()

const { data: keys } = useApiKeys()
const createMutation = useCreateModel()
const updateMutation = useUpdateModel()

const submitting = computed(
  () => createMutation.isPending.value || updateMutation.isPending.value,
)
const isEdit = computed(() => !!props.model)

// 防御：非数组兜底
const keyList = computed(() => (Array.isArray(keys.value) ? keys.value : []))
// 凭证按 Provider 分组展示（凭证层 → 注册层，一个凭证可被同 Provider 的多个模型引用）
const keyGroups = computed(() =>
  PROVIDERS.map((p) => ({
    ...p,
    items: keyList.value.filter((k) => k.provider === p.value),
  })).filter((g) => g.items.length > 0),
)

const formRef = ref<FormInstance>()
const form = reactive({
  provider: 'deepseek' as ModelProvider,
  modelName: '',
  type: 'chat' as ModelType,
  displayName: '',
  description: '',
  /** '' = 不关联凭证（后端 NULL，使用环境变量默认） */
  apiKeyId: '',
  isActive: true,
})

// config 按类型拆分三个独立对象，模板类型安全；提交时按当前 type 组装
const chatConfig = reactive<ModelChatConfig>({ maxTokens: 4096, temperature: 0.7, supportsVision: false, supportsTools: true })
const embedConfig = reactive<ModelEmbeddingConfig>({ dimension: 1536, maxBatchSize: 2048 })
const rerankConfig = reactive<ModelRerankConfig>({ maxBatchSize: 100 })

const TYPE_ICONS: Record<ModelType, typeof ChatDotRound> = {
  chat: ChatDotRound,
  embedding: DataLine,
  rerank: Sort,
}

const rules: FormRules = {
  provider: [{ required: true, message: '请选择 Provider', trigger: 'change' }],
  modelName: [
    { required: true, message: '请输入模型名称', trigger: 'blur' },
    { pattern: /^[a-zA-Z0-9][a-zA-Z0-9._/-]{0,127}$/, message: '仅支持字母、数字及 . _ - /（如 gpt-4o / deepseek-v4-pro）', trigger: 'blur' },
  ],
  type: [{ required: true, message: '请选择模型类型', trigger: 'change' }],
  displayName: [{ required: true, message: '请输入显示名称', trigger: 'blur' }],
}

function resetConfigs(type: ModelType) {
  Object.assign(chatConfig, createDefaultConfig('chat'))
  Object.assign(embedConfig, createDefaultConfig('embedding'))
  Object.assign(rerankConfig, createDefaultConfig('rerank'))
  void type
}

function resetForm() {
  form.provider = 'deepseek'
  form.modelName = ''
  form.type = 'chat'
  form.displayName = ''
  form.description = ''
  form.apiKeyId = ''
  form.isActive = true
  resetConfigs('chat')
  formRef.value?.clearValidate()
}

function fillEdit(m: Model) {
  form.provider = m.provider
  form.modelName = m.modelName
  form.type = m.type
  form.displayName = m.displayName
  form.description = m.description ?? ''
  form.apiKeyId = m.apiKeyId ?? ''
  form.isActive = m.isActive
  resetConfigs(m.type)
  if (m.type === 'chat') Object.assign(chatConfig, (m.config as ModelChatConfig) ?? {})
  else if (m.type === 'embedding') Object.assign(embedConfig, (m.config as ModelEmbeddingConfig) ?? {})
  else Object.assign(rerankConfig, (m.config as ModelRerankConfig) ?? {})
  formRef.value?.clearValidate()
}

watch(
  () => [visible.value, props.model] as const,
  ([v, m]) => {
    if (!v) return
    if (m) fillEdit(m)
    else resetForm()
  },
)

// 切换类型时重建对应 config 默认模板
function handleTypeChange(type: ModelType) {
  if (type === 'chat') Object.assign(chatConfig, createDefaultConfig('chat'))
  else if (type === 'embedding') Object.assign(embedConfig, createDefaultConfig('embedding'))
  else Object.assign(rerankConfig, createDefaultConfig('rerank'))
}

// 凭证与 Provider 解耦联动：选择某凭证后自动同步 Provider（models.provider 需与 api_keys.provider 一致）
function handleApiKeyChange(id: string) {
  if (!id) return
  const key = keyList.value.find((k) => k.id === id)
  if (key && key.provider !== form.provider) {
    form.provider = key.provider
  }
}

function buildConfig(): ModelConfig {
  if (form.type === 'chat') {
    return {
      maxTokens: chatConfig.maxTokens,
      temperature: chatConfig.temperature,
      supportsVision: chatConfig.supportsVision,
      supportsTools: chatConfig.supportsTools,
    }
  }
  if (form.type === 'embedding') {
    return { dimension: embedConfig.dimension, maxBatchSize: embedConfig.maxBatchSize }
  }
  return { maxBatchSize: rerankConfig.maxBatchSize }
}

function validateConfig(): string | null {
  // 边界取自 @nexus/model-config MODEL_CONFIG_LIMITS，与后端 validateConfig 一致
  const range = (v: number | undefined, bound: { min: number; max: number }, label: string) =>
    v !== undefined && (v < bound.min || v > bound.max) ? `${label} 需在 ${bound.min} ~ ${bound.max} 之间` : null
  if (form.type === 'chat') {
    const limits = MODEL_CONFIG_LIMITS.chat
    return range(chatConfig.maxTokens, limits.maxTokens, 'maxTokens') ?? range(chatConfig.temperature, limits.temperature, 'temperature')
  } else if (form.type === 'embedding') {
    const limits = MODEL_CONFIG_LIMITS.embedding
    return range(embedConfig.dimension, limits.dimension, '向量维度')
  }
  return null
}

async function handleSubmit() {
  const valid = await formRef.value?.validate().catch(() => false)
  if (!valid) return
  const configError = validateConfig()
  if (configError) {
    ElMessage.error(configError)
    return
  }
  const payload = {
    provider: form.provider,
    modelName: form.modelName.trim(),
    type: form.type,
    displayName: form.displayName.trim(),
    description: form.description.trim() || null,
    apiKeyId: form.apiKeyId || null,
    config: buildConfig(),
  }
  try {
    if (isEdit.value && props.model) {
      await updateMutation.mutateAsync({
        id: props.model.id,
        data: { ...payload, isActive: form.isActive },
      })
    } else {
      await createMutation.mutateAsync(payload)
    }
    ElMessage.success(isEdit.value ? '模型已更新' : '模型注册成功')
    emit('saved')
  } catch (e) {
    ElMessage.error((e as Error).message || '保存失败')
  }
}
</script>

<template>
  <el-dialog
    v-model="visible"
    :title="isEdit ? '编辑模型' : '注册模型'"
    width="560px"
    @closed="resetForm"
  >
    <el-form
      ref="formRef"
      :model="form"
      :rules="rules"
      label-position="top"
    >
      <div class="grid grid-cols-2 gap-4">
        <el-form-item
          label="Provider"
          prop="provider"
        >
          <el-select
            v-model="form.provider"
            style="width: 100%"
          >
            <el-option
              v-for="p in PROVIDERS"
              :key="p.value"
              :label="p.label"
              :value="p.value"
            >
              <span class="flex items-center gap-2">
                <span
                  class="h-2 w-2 rounded-full"
                  :style="{ background: p.brand }"
                />
                {{ p.label }}
              </span>
            </el-option>
          </el-select>
        </el-form-item>
        <el-form-item
          label="模型名称"
          prop="modelName"
        >
          <el-input
            v-model="form.modelName"
            placeholder="如 gpt-4o / deepseek-v4-pro"
            class="font-mono"
            maxlength="128"
          />
        </el-form-item>
      </div>

      <el-form-item
        label="模型类型"
        prop="type"
      >
        <el-radio-group
          :model-value="form.type"
          class="w-full"
          @update:model-value="(v: ModelType) => { form.type = v; handleTypeChange(v) }"
        >
          <el-radio-button
            v-for="t in MODEL_TYPES"
            :key="t.value"
            :value="t.value"
            class="flex-1"
          >
            <span class="flex items-center justify-center gap-1.5">
              <el-icon :size="14">
                <component :is="TYPE_ICONS[t.value]" />
              </el-icon>
              {{ t.label }}
            </span>
          </el-radio-button>
        </el-radio-group>
      </el-form-item>

      <el-form-item
        label="显示名称"
        prop="displayName"
      >
        <el-input
          v-model="form.displayName"
          placeholder="如 GPT-4o / DeepSeek Chat"
          maxlength="256"
          show-word-limit
        />
      </el-form-item>

      <el-form-item label="描述（可选）">
        <el-input
          v-model="form.description"
          type="textarea"
          :rows="2"
          placeholder="模型用途、适用场景等"
          maxlength="500"
        />
      </el-form-item>

      <el-form-item label="关联凭证（可选）">
        <el-select
          :model-value="form.apiKeyId"
          clearable
          filterable
          placeholder="选择该 Provider 下的 API Key"
          style="width: 100%"
          @update:model-value="(v: string) => { form.apiKeyId = v ?? ''; handleApiKeyChange(v ?? '') }"
        >
          <el-option
            label="不关联 — 使用环境变量默认"
            value=""
          >
            <span class="flex items-center gap-2">
              <el-icon :size="14">
                <Link />
              </el-icon>
              不关联 — 使用环境变量默认
            </span>
          </el-option>
          <el-option-group
            v-for="g in keyGroups"
            :key="g.value"
            :label="g.label"
          >
            <el-option
              v-for="k in g.items"
              :key="k.id"
              :label="k.name"
              :value="k.id"
            />
          </el-option-group>
        </el-select>
        <div
          class="mt-1.5 flex items-start gap-1.5 text-xs"
          style="color: var(--foreground); opacity: 0.55"
        >
          <el-icon
            :size="13"
            style="margin-top: 1px"
          >
            <Key />
          </el-icon>
          <span>
            模型仅引用凭证、不存储密钥；同一 Provider 的多个模型可共享一个凭证。选择凭证后 Provider 自动同步。
          </span>
        </div>
      </el-form-item>

      <!-- 能力参数：按类型动态渲染（结构与 DATABASE.md 4.20 config 注释一致） -->
      <div
        v-if="form.type === 'chat'"
        class="rounded-xl border p-4"
        style="border-color: var(--border)"
      >
        <div
          class="mb-3 text-xs font-medium"
          style="color: var(--foreground); opacity: 0.6"
        >
          对话能力参数
        </div>
        <div class="grid grid-cols-2 gap-4">
          <el-form-item label="maxTokens">
            <el-input-number
              v-model="chatConfig.maxTokens"
              :min="MODEL_CONFIG_LIMITS.chat.maxTokens.min"
              :max="MODEL_CONFIG_LIMITS.chat.maxTokens.max"
              :step="512"
              controls-position="right"
              style="width: 100%"
            />
          </el-form-item>
          <el-form-item label="temperature">
            <el-input-number
              v-model="chatConfig.temperature"
              :min="MODEL_CONFIG_LIMITS.chat.temperature.min"
              :max="MODEL_CONFIG_LIMITS.chat.temperature.max"
              :step="0.1"
              :precision="1"
              controls-position="right"
              style="width: 100%"
            />
          </el-form-item>
        </div>
        <div class="grid grid-cols-2 gap-4">
          <div
            class="flex items-center justify-between rounded-lg border px-3 py-2"
            style="border-color: var(--border)"
          >
            <span
              class="text-sm"
              style="color: var(--foreground)"
            >支持视觉输入</span>
            <el-switch v-model="chatConfig.supportsVision" />
          </div>
          <div
            class="flex items-center justify-between rounded-lg border px-3 py-2"
            style="border-color: var(--border)"
          >
            <span
              class="text-sm"
              style="color: var(--foreground)"
            >支持工具调用</span>
            <el-switch v-model="chatConfig.supportsTools" />
          </div>
        </div>
      </div>

      <div
        v-else-if="form.type === 'embedding'"
        class="rounded-xl border p-4"
        style="border-color: var(--border)"
      >
        <div
          class="mb-3 text-xs font-medium"
          style="color: var(--foreground); opacity: 0.6"
        >
          嵌入能力参数
        </div>
        <div class="grid grid-cols-2 gap-4">
          <el-form-item label="向量维度 (dimension)">
            <el-input-number
              v-model="embedConfig.dimension"
              :min="MODEL_CONFIG_LIMITS.embedding.dimension.min"
              :max="MODEL_CONFIG_LIMITS.embedding.dimension.max"
              :step="64"
              controls-position="right"
              style="width: 100%"
            />
          </el-form-item>
          <el-form-item label="最大批量 (maxBatchSize)">
            <el-input-number
              v-model="embedConfig.maxBatchSize"
              :min="MODEL_CONFIG_LIMITS.embedding.maxBatchSize.min"
              :max="MODEL_CONFIG_LIMITS.embedding.maxBatchSize.max"
              :step="128"
              controls-position="right"
              style="width: 100%"
            />
          </el-form-item>
        </div>
      </div>

      <div
        v-else
        class="rounded-xl border p-4"
        style="border-color: var(--border)"
      >
        <div
          class="mb-3 text-xs font-medium"
          style="color: var(--foreground); opacity: 0.6"
        >
          重排序能力参数
        </div>
        <el-form-item label="最大批量 (maxBatchSize)">
          <el-input-number
            v-model="rerankConfig.maxBatchSize"
            :min="MODEL_CONFIG_LIMITS.rerank.maxBatchSize.min"
            :max="MODEL_CONFIG_LIMITS.rerank.maxBatchSize.max"
            :step="16"
            controls-position="right"
            style="width: 100%"
          />
        </el-form-item>
      </div>

      <el-form-item
        v-if="isEdit"
        label="状态"
      >
        <div class="flex items-center gap-3">
          <el-switch v-model="form.isActive" />
          <span
            class="text-xs"
            style="color: var(--foreground); opacity: 0.55"
          >停用后该模型将无法在平台中被选用</span>
        </div>
      </el-form-item>
    </el-form>

    <template #footer>
      <el-button @click="visible = false">
        取消
      </el-button>
      <el-button
        type="primary"
        :loading="submitting"
        @click="handleSubmit"
      >
        {{ isEdit ? '保存' : '注册' }}
      </el-button>
    </template>
  </el-dialog>
</template>

<style scoped>
/* 类型选择按钮等宽占满一行 */
:deep(.el-radio-group) {
  display: flex;
}
:deep(.el-radio-button) {
  flex: 1;
}
:deep(.el-radio-button__inner) {
  width: 100%;
}
</style>
