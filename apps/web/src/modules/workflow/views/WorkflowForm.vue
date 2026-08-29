<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import type { FormInstance, FormRules } from 'element-plus'
import { ArrowLeft, Delete, Plus } from '@element-plus/icons-vue'
import {
  useCreateWorkflow,
  useUpdateWorkflow,
  useWorkflow,
} from '@/modules/workflow/composables/useWorkflow'
import {
  WORKFLOW_NODE_TYPES,
  WORKFLOW_NODE_TYPE_LABELS,
  WORKFLOW_TYPES,
  WORKFLOW_TYPE_LABELS,
  WORKFLOW_TYPE_META,
  type Workflow,
  type WorkflowNodeType,
} from '@/modules/workflow/types/workflow'
import {
  addClientNode,
  addEdge,
  buildWorkflowPayload,
  emptyForm,
  formFromWorkflow,
  removeEdge,
  removeNode,
} from '@/modules/workflow/utils/workflow-payload'

const route = useRoute()
const router = useRouter()
const wfId = computed(() => String(route.params.id ?? ''))
const isEdit = computed(() => !!wfId.value)

const { data: existing, isLoading: loadingExisting } = useWorkflow(wfId)
const createMutation = useCreateWorkflow()
const updateMutation = useUpdateWorkflow()

const formRef = ref<FormInstance>()
const form = reactive(emptyForm())
const populated = ref(false)

// 编辑模式：详情到达后回填一次
watch(
  existing,
  (wf) => {
    if (wf && !populated.value) {
      Object.assign(form, formFromWorkflow(wf as Workflow))
      populated.value = true
    }
  },
  { immediate: true },
)

const rules: FormRules = {
  name: [{ required: true, message: '请输入工作流名称', trigger: 'blur' }],
  type: [{ required: true, message: '请选择工作流类型', trigger: 'change' }],
}

const submitting = computed(
  () => createMutation.isPending.value || updateMutation.isPending.value,
)

// 节点类型选项
const nodeTypeOptions = WORKFLOW_NODE_TYPES.map((t) => ({
  value: t,
  label: WORKFLOW_NODE_TYPE_LABELS[t],
}))

function handleAddNode(type: WorkflowNodeType) {
  addClientNode(form, type)
}

async function handleSubmit() {
  try {
    await formRef.value?.validate()
  } catch {
    return
  }
  let payload
  try {
    payload = buildWorkflowPayload(form)
  } catch (e) {
    ElMessage.error((e as Error).message)
    return
  }
  try {
    if (isEdit.value) {
      await updateMutation.mutateAsync({ id: wfId.value, data: payload })
      ElMessage.success('工作流已保存')
      router.push(`/workflows/${wfId.value}`)
    } else {
      const created = await createMutation.mutateAsync(payload)
      ElMessage.success('工作流已创建')
      router.push(`/workflows/${created.id}`)
    }
  } catch (e) {
    ElMessage.error((e as Error).message || '保存失败')
  }
}

/** 节点 ID 显示 (edges 下拉选择用) */
function nodeLabel(idx: number) {
  const n = form.nodes[idx]
  return n.label.trim() || `节点 #${idx + 1}（${WORKFLOW_NODE_TYPE_LABELS[n.type]}）`
}
</script>

<template>
  <div class="mx-auto pb-8">
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
        {{ isEdit ? '编辑工作流' : '创建工作流' }}
      </h1>
    </div>

    <el-skeleton
      v-if="isEdit && loadingExisting"
      animated
      :rows="10"
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
        <div class="grid grid-cols-1 gap-x-4 md:grid-cols-2">
          <el-form-item
            label="名称"
            prop="name"
          >
            <el-input
              v-model="form.name"
              maxlength="256"
              show-word-limit
              placeholder="例如：合同审查 RAG"
            />
          </el-form-item>
          <el-form-item
            label="策略类型"
            prop="type"
          >
            <el-select
              v-model="form.type"
              class="w-full"
              :disabled="isEdit"
            >
              <el-option
                v-for="t in WORKFLOW_TYPES"
                :key="t"
                :label="`${WORKFLOW_TYPE_META[t].icon} ${WORKFLOW_TYPE_LABELS[t]}`"
                :value="t"
              >
                <div class="flex items-center justify-between gap-2">
                  <span>{{ WORKFLOW_TYPE_META[t].icon }} {{ WORKFLOW_TYPE_LABELS[t] }}</span>
                  <span
                    class="text-xs"
                    style="opacity: 0.55"
                  >
                    {{ t }}
                  </span>
                </div>
              </el-option>
            </el-select>
            <p
              class="mt-1 text-xs"
              style="color: var(--foreground); opacity: 0.55"
            >
              {{ WORKFLOW_TYPE_META[form.type].hint }}
            </p>
          </el-form-item>
        </div>
        <el-form-item label="描述">
          <el-input
            v-model="form.description"
            type="textarea"
            :rows="2"
            placeholder="这个工作流做什么"
          />
        </el-form-item>
        <el-form-item label="启用">
          <el-switch
            v-model="form.isActive"
            active-text="启用"
            inactive-text="停用"
          />
        </el-form-item>
      </el-card>

      <!-- 顶层 config -->
      <el-card class="mb-4">
        <h2
          class="mb-1 text-sm font-semibold"
          style="color: var(--foreground)"
        >
          顶层配置 (JSON)
        </h2>
        <p
          class="mb-3 text-xs"
          style="color: var(--foreground); opacity: 0.55"
        >
          各类型特定配置。示例：rag = <code>{ "retriever": { "topK": 4 } }</code>；reflection =
          <code>{ "maxIterations": 2, "judgePrompt": "..." }</code>
        </p>
        <el-input
          v-model="form.configText"
          type="textarea"
          :rows="5"
          spellcheck="false"
          class="config-textarea"
        />
      </el-card>

      <!-- 节点 -->
      <el-card class="mb-4">
        <div class="mb-3 flex items-center justify-between">
          <h2
            class="text-sm font-semibold"
            style="color: var(--foreground)"
          >
            节点 ({{ form.nodes.length }})
          </h2>
          <el-dropdown @command="handleAddNode">
            <el-button
              size="small"
              :icon="Plus"
            >
              添加节点
            </el-button>
            <template #dropdown>
              <el-dropdown-menu>
                <el-dropdown-item
                  v-for="opt in nodeTypeOptions"
                  :key="opt.value"
                  :command="opt.value"
                >
                  {{ opt.label }}（{{ opt.value }}）
                </el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>
        </div>
        <el-empty
          v-if="!form.nodes.length"
          description="暂无节点"
          :image-size="60"
        />
        <div
          v-else
          class="flex flex-col gap-3"
        >
          <div
            v-for="(node, idx) in form.nodes"
            :key="node.clientId"
            class="rounded-lg border p-3"
            style="border-color: var(--border); background: var(--surface-secondary)"
          >
            <div class="mb-2 flex items-center justify-between gap-2">
              <div class="flex items-center gap-2">
                <el-tag
                  size="small"
                  effect="dark"
                >
                  {{ WORKFLOW_NODE_TYPE_LABELS[node.type] }}
                </el-tag>
                <span
                  class="text-xs"
                  style="color: var(--foreground); opacity: 0.5"
                >
                  {{ node.type }} · {{ node.clientId }}
                </span>
              </div>
              <el-button
                text
                type="danger"
                size="small"
                :icon="Delete"
                aria-label="删除节点"
                @click="removeNode(form, node.clientId)"
              />
            </div>
            <div class="grid grid-cols-1 gap-x-3 md:grid-cols-2">
              <el-form-item :label="`节点 #${idx + 1} 标签`">
                <el-input
                  v-model="node.label"
                  placeholder="如：检索 KB、LLM 生成"
                  maxlength="128"
                />
              </el-form-item>
              <el-form-item label="描述">
                <el-input
                  v-model="node.description"
                  placeholder="（可选）"
                />
              </el-form-item>
            </div>
            <el-form-item label="节点配置 (JSON)">
              <el-input
                v-model="node.configText"
                type="textarea"
                :rows="2"
                spellcheck="false"
                class="config-textarea"
              />
            </el-form-item>
          </div>
        </div>
      </el-card>

      <!-- 边 -->
      <el-card class="mb-4">
        <div class="mb-3 flex items-center justify-between">
          <h2
            class="text-sm font-semibold"
            style="color: var(--foreground)"
          >
            边 ({{ form.edges.length }})
          </h2>
          <el-button
            size="small"
            :icon="Plus"
            :disabled="form.nodes.length < 2"
            @click="addEdge(form)"
          >
            添加边
          </el-button>
        </div>
        <el-empty
          v-if="!form.edges.length"
          description="暂无边（需要至少 2 个节点）"
          :image-size="60"
        />
        <div
          v-else
          class="flex flex-col gap-2"
        >
          <div
            v-for="(edge, idx) in form.edges"
            :key="idx"
            class="flex items-center gap-2"
          >
            <el-select
              v-model="edge.sourceClientId"
              placeholder="起点"
              class="!w-1/3"
            >
              <el-option
                v-for="(n, ni) in form.nodes"
                :key="n.clientId"
                :label="nodeLabel(ni)"
                :value="n.clientId"
              />
            </el-select>
            <span style="opacity: 0.5">→</span>
            <el-select
              v-model="edge.targetClientId"
              placeholder="终点"
              class="!w-1/3"
            >
              <el-option
                v-for="(n, ni) in form.nodes"
                :key="n.clientId"
                :label="nodeLabel(ni)"
                :value="n.clientId"
              />
            </el-select>
            <el-input
              v-model="edge.label"
              placeholder="（可选）边标签 / condition"
              class="!flex-1"
            />
            <el-button
              text
              type="danger"
              :icon="Delete"
              aria-label="删除边"
              @click="removeEdge(form, idx)"
            />
          </div>
        </div>
        <p
          class="mt-3 text-xs"
          style="color: var(--foreground); opacity: 0.5"
        >
          提示：拖拽式 Designer 属 V3（Vue Flow）；这里采用「表单+JSON」提供 V2 基础编辑能力
        </p>
      </el-card>

      <div class="flex justify-end gap-3">
        <el-button @click="router.back()">
          取消
        </el-button>
        <el-button
          type="primary"
          :loading="submitting"
          @click="handleSubmit"
        >
          {{ isEdit ? '保存' : '创建工作流' }}
        </el-button>
      </div>
    </el-form>
  </div>
</template>

<style scoped>
.config-textarea :deep(textarea) {
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 12px;
  line-height: 1.5;
}
</style>
