# 新建会话配置弹窗 + @nexus/config 公共包 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 新建会话改为「ElDialog 收集配置 → 立即创建 → 跳转 /chat/:id」，并把 workflow_type 枚举与 model-config 统一收进新公共包 `@nexus/config`。

**Architecture:** 弹窗组件 `CreateSessionDialog` 挂载在 `ChatSessionList` 内（两个视图复用，单点生效）；提交 payload 的 `workflowType` 取自所选 workflow 的 `type`，未选默认 `'rag'`；`packages/config`（当前空目录）建成纯 TS 常量包，迁移现有 `@nexus/model-config` 并删除旧包。后端 `POST /chat/sessions` 不在本计划范围（用户自行实现）。

**Tech Stack:** Vue 3 + Element Plus + @tanstack/vue-query + vitest（web）；NestJS（api）；pnpm workspace + turbo；包消费模式：**web 经 vite alias 消费 TS 源，api 消费 dist 产物**。

**Spec:** `docs/superpowers/specs/2026-08-19-chat-create-session-dialog-design.md`

**Commit 约定：** 使用本地 git 账号信息，commit message 不附加 Co-Authored-By。monorepo 根目录执行命令。macOS zsh。

---

### Task 1: 建 `@nexus/config` 包（迁入 model-config + 新增 workflow-config）

**Files:**
- Create: `packages/config/package.json`
- Create: `packages/config/tsconfig.json`
- Create: `packages/config/src/model-config.ts`（由 `packages/model-config/src/index.ts` git mv，内容不变）
- Create: `packages/config/src/workflow-config.ts`
- Create: `packages/config/src/index.ts`

- [ ] **Step 1: git mv 迁移 model-config 源文件**

```bash
mkdir -p packages/config/src
git mv packages/model-config/src/index.ts packages/config/src/model-config.ts
```

- [ ] **Step 2: 写 `packages/config/package.json`**

仿 `packages/model-config/package.json`：

```json
{
  "name": "@nexus/config",
  "version": "0.0.1",
  "description": "共享配置常量（model/workflow 等，不同 config 一个 ts 文件）— api、web、worker 共用单一来源",
  "private": true,
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "default": "./dist/index.js"
    }
  },
  "scripts": {
    "dev": "tsc -p tsconfig.json --watch --preserveWatchOutput",
    "build": "tsc -p tsconfig.json"
  },
  "devDependencies": {
    "typescript": "^6.0.3"
  }
}
```

- [ ] **Step 3: 写 `packages/config/tsconfig.json`**

与 `packages/model-config/tsconfig.json` 完全一致：

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "target": "ES2023",
    "module": "nodenext",
    "moduleResolution": "nodenext",
    "declaration": true,
    "removeComments": true,
    "sourceMap": true,
    "rootDir": "./src",
    "outDir": "./dist"
  },
  "include": ["src/**/*.ts"],
  "exclude": ["node_modules", "dist"]
}
```

- [ ] **Step 4: 写 `packages/config/src/workflow-config.ts`**

```ts
// Workflow 类型枚举 — 单一来源（DATABASE.md workflow_type_enum / chat_sessions.workflow_type CHECK）
// api（DTO @IsIn 校验）、web（新建会话弹窗、会话列表 tag）、后期 Workflow 模块共用
export const WORKFLOW_TYPES = ['rag', 'reflection', 'rewoo', 'multi_agent'] as const;

export type WorkflowType = (typeof WORKFLOW_TYPES)[number];

export const DEFAULT_WORKFLOW_TYPE: WorkflowType = 'rag';

export const WORKFLOW_TYPE_LABELS: Record<WorkflowType, string> = {
  rag: 'RAG 问答',
  reflection: 'Reflection',
  rewoo: 'ReWOO',
  multi_agent: '多智能体',
};
```

- [ ] **Step 5: 写 `packages/config/src/index.ts`**

nodenext 模块解析要求相对导入带 `.js` 后缀：

```ts
export * from './model-config.js';
export * from './workflow-config.js';
```

- [ ] **Step 6: 安装并构建验证**

```bash
pnpm install
pnpm --filter @nexus/config build
ls packages/config/dist/index.js packages/config/dist/workflow-config.d.ts
```

Expected: 两个文件均存在，tsc 无报错。

- [ ] **Step 7: Commit**

```bash
git add packages/config
git commit -m "feat(config): @nexus/config 共享配置包——迁入 model-config + 新增 workflow-config"
```

---

### Task 2: 消费方迁移 `@nexus/model-config` → `@nexus/config`，删除旧包

**Files:**
- Modify: `apps/web/package.json`
- Modify: `apps/api/package.json`
- Modify: `apps/web/vite.config.ts:11-12`
- Modify: `apps/web/src/modules/api-keys/types/api-key.ts:2`
- Modify: `apps/web/src/modules/models/types/model.ts:15,24,29,65`
- Modify: `apps/web/src/modules/models/components/ModelForm.vue:149`（注释）
- Modify: `apps/api/src/modules/model/model.service.ts:8,152`
- Delete: `packages/model-config/`

- [ ] **Step 1: 批量替换源码中的包名引用（含注释，保持文档准确）**

```bash
sed -i '' 's|@nexus/model-config|@nexus/config|g' \
  apps/web/src/modules/api-keys/types/api-key.ts \
  apps/web/src/modules/models/types/model.ts \
  apps/web/src/modules/models/components/ModelForm.vue \
  apps/api/src/modules/model/model.service.ts \
  apps/web/vite.config.ts
grep -rn "@nexus/model-config" apps/web/src apps/api/src apps/web/vite.config.ts
```

Expected: grep 无输出（全部替换干净）。

- [ ] **Step 2: 修 vite alias 的文件系统路径**

Step 1 只替换了别名 key，value 里的路径还要改。`apps/web/vite.config.ts` 第 12 行：

```ts
      // 纯常量 workspace 包直接消费 TS 源（api 侧仍消费 dist）；避免 Rollup 对 CJS dist 的命名导出检测问题
      '@nexus/config': resolve(__dirname, '../../packages/config/src/index.ts'),
```

可用 sed 一步完成：

```bash
sed -i '' 's|packages/model-config/src/index.ts|packages/config/src/index.ts|' apps/web/vite.config.ts
```

- [ ] **Step 3: 两个 app 的 package.json 依赖替换**

`apps/web/package.json` dependencies 中：

```diff
-    "@nexus/model-config": "workspace:*",
+    "@nexus/config": "workspace:*",
```

`apps/api/package.json` dependencies 中同样替换一行。

- [ ] **Step 4: 删除旧包并重新链接 workspace**

```bash
git rm -r packages/model-config
pnpm install
```

- [ ] **Step 5: 回归验证（models / api-keys 模块不受影响）**

```bash
pnpm --filter @nexus/web test:run
pnpm --filter @nexus/web check-types
pnpm --filter @nexus/api build
```

Expected: 全部通过（此时 chat 模块尚未改动，现有测试全绿）。

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "refactor(config): 消费方迁移 @nexus/model-config → @nexus/config 并删除旧包"
```

---

### Task 3: chat 创建契约（payload 类型 + 创建 mutation + 选项源 enabled + 移除懒创建/pendingCreate）

**Files:**
- Modify: `apps/web/src/modules/chat/api/chat.api.ts`
- Modify: `apps/web/src/modules/chat/composables/useChat.ts`
- Modify: `apps/web/src/modules/chat/types/chat.ts:1-3`
- Modify: `apps/web/src/modules/chat/components/ChatStreamStatus.vue:11,14`
- Create: `apps/web/src/modules/prompt/composables/usePrompts.ts`
- Modify: `apps/web/src/modules/knowledge/composables/useKnowledge.ts:5-10`
- Modify: `apps/web/src/modules/ai-application/composables/useAiApplications.ts:5-10`
- Modify: `apps/web/src/modules/workflow/composables/useWorkflow.ts:5-7`

- [ ] **Step 1: 改 `chat.api.ts` — 新增 CreateSessionPayload，收紧 createSession 签名**

完整新文件：

```ts
import http from '@/api/client'
import type { WorkflowType } from '@nexus/config'
import type { ChatMessage, ChatSession } from '../types/chat'

export interface CreateSessionPayload {
  title: string
  kbId?: string
  promptTemplateId?: string
  aiApplicationId?: string
  workflowId?: string
  workflowType: WorkflowType
}

export const chatApi = {
  listSessions(): Promise<ChatSession[]> {
    return http.get('/chat/sessions')
  },
  getSession(id: string): Promise<ChatSession> {
    return http.get(`/chat/sessions/${id}`)
  },
  createSession(data: CreateSessionPayload): Promise<ChatSession> {
    return http.post('/chat/sessions', data)
  },
  deleteSession(id: string): Promise<void> {
    return http.delete(`/chat/sessions/${id}`)
  },
  getMessages(sessionId: string): Promise<ChatMessage[]> {
    return http.get(`/chat/sessions/${sessionId}/messages`)
  },
  sendMessage(sessionId: string, content: string): Promise<ChatMessage> {
    return http.post(`/chat/sessions/${sessionId}/messages`, { content })
  },
  sendFeedback(messageId: string, action: 'like' | 'dislike', comment?: string): Promise<void> {
    // 线字段为 rating（对齐后端契约 POST /chat/messages/:id/feedback body {rating, comment?}）
    return http.post(`/chat/messages/${messageId}/feedback`, { rating: action, comment })
  },
}
```

- [ ] **Step 2: `useChat.ts` — 新增 useCreateChatSession，删除 send() 的 new 懒创建分支与 router**

2a. 在 `useChatSessions` 之后新增：

```ts
export function useCreateChatSession() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: CreateSessionPayload) => chatApi.createSession(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['chat-sessions'] })
    },
  })
}
```

并更新文件顶部导入：`import { chatApi, type CreateSessionPayload } from '@/modules/chat/api/chat.api'`。

2b. 删除 `useChatStream` 中的懒创建分支。当前 `send()` 内（useChat.ts:110-122）：

```ts
    let sid = toValue(sessionId)
    if (sid === 'new') {
      phase.value = 'pendingCreate'
      try {
        const session = await chatApi.createSession()
        sid = session.id
        router.replace(`/chat/${sid}`)
      } catch {
        phase.value = 'error'
        error.value = '创建会话失败'
        return
      }
    }
```

替换为：

```ts
    const sid = toValue(sessionId)
```

2c. `router` 不再使用：删除 `const router = useRouter()`（useChat.ts:56）与顶部 `import { useRouter } from 'vue-router'`。

2d. `isStreaming` 移除 pendingCreate（useChat.ts:63-65）：

```ts
  const isStreaming = computed(
    () => phase.value === 'retrieving' || phase.value === 'reranking' || phase.value === 'generating',
  )
```

2e. `useChatMessages` 的 enabled 去掉 `'new'` 判断（useChat.ts:27）：

```ts
    enabled: () => !!toValue(sessionId),
```

- [ ] **Step 3: `types/chat.ts` — MessagePhase 移除 'pendingCreate'**

```ts
export type MessagePhase =
  | 'idle' | 'retrieving' | 'reranking'
  | 'generating' | 'done' | 'error' | 'aborted'
```

- [ ] **Step 4: `ChatStreamStatus.vue` — 移除 pendingCreate 文案与可见性**

labelMap 删除 `pendingCreate: '正在创建会话…',` 一行；visible 改为：

```ts
const visible = computed(() => ['retrieving', 'reranking', 'generating'].includes(props.phase))
```

- [ ] **Step 5: 新建 `apps/web/src/modules/prompt/composables/usePrompts.ts`**

```ts
import { useQuery } from '@tanstack/vue-query'
import { toValue, type MaybeRef } from 'vue'
import { promptsApi } from '@/modules/prompt/api/prompt.api'

export function usePromptTemplates(enabled: MaybeRef<boolean> = true) {
  return useQuery({
    queryKey: ['prompt-templates'],
    queryFn: () => promptsApi.list(),
    enabled: () => toValue(enabled),
  })
}
```

- [ ] **Step 6: 三个现有 composable 加可选 enabled 参数（向后兼容，默认 true）**

`useKnowledge.ts` 的 `useKnowledgeBases`：

```ts
export function useKnowledgeBases(enabled: MaybeRef<boolean> = true) {
  return useQuery({
    queryKey: ['knowledge-base'],
    queryFn: () => knowledgeBasesApi.list(),
    enabled: () => toValue(enabled),
  })
}
```

`useAiApplications.ts` 的 `useAiApplications`：

```ts
export function useAiApplications(enabled: MaybeRef<boolean> = true) {
  return useQuery({
    queryKey: ['ai-applications'],
    queryFn: () => aiApplicationsApi.list(),
    enabled: () => toValue(enabled),
  })
}
```

`useWorkflow.ts` 的 `useWorkflows`：

```ts
export function useWorkflows(enabled: MaybeRef<boolean> = true) {
  return useQuery({
    queryKey: ['workflows'],
    queryFn: () => workflowsApi.list(),
    enabled: () => toValue(enabled),
  })
}
```

- [ ] **Step 7: 验证编译与现有测试**

```bash
pnpm --filter @nexus/web check-types
pnpm --filter @nexus/web test:run
```

Expected: 通过（useChatStream.spec.ts 不覆盖 new 分支，无测试需要改）。

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat(chat): 会话创建契约——CreateSessionPayload + useCreateChatSession + 选项源 enabled 参数；移除懒创建与 pendingCreate"
```

---

### Task 4: `CreateSessionDialog.vue`（TDD）

**Files:**
- Test: `apps/web/src/modules/chat/__tests__/CreateSessionDialog.spec.ts`
- Create: `apps/web/src/modules/chat/components/CreateSessionDialog.vue`

模式参照 `apps/web/src/modules/knowledge/components/KnowledgeCreateDialog.vue`（defineModel visible + reactive form + FormRules + watch(visible) 重置）。

- [ ] **Step 1: 写失败测试 `CreateSessionDialog.spec.ts`**

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises, type VueWrapper } from '@vue/test-utils'
import ElementPlus from 'element-plus'
import { VueQueryPlugin, QueryClient } from '@tanstack/vue-query'
import CreateSessionDialog from '../components/CreateSessionDialog.vue'

const createSession = vi.fn()
const kbList = vi.fn()
const promptList = vi.fn()
const appList = vi.fn()
const workflowList = vi.fn()

vi.mock('@/modules/chat/api/chat.api', () => ({
  chatApi: { createSession: (...args: unknown[]) => createSession(...args) },
}))
vi.mock('@/modules/knowledge/api/knowledge.api', () => ({
  knowledgeBasesApi: { list: (...args: unknown[]) => kbList(...args) },
}))
vi.mock('@/modules/prompt/api/prompt.api', () => ({
  promptsApi: { list: (...args: unknown[]) => promptList(...args) },
}))
vi.mock('@/modules/ai-application/api/ai-application.api', () => ({
  aiApplicationsApi: { list: (...args: unknown[]) => appList(...args) },
}))
vi.mock('@/modules/workflow/api/workflow.api', () => ({
  workflowsApi: { list: (...args: unknown[]) => workflowList(...args) },
}))

function mountDialog(props: Record<string, unknown> = {}) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return mount(CreateSessionDialog, {
    props: { visible: true, ...props },
    global: {
      plugins: [ElementPlus, [VueQueryPlugin, { queryClient: qc }]],
      // el-dialog 默认 teleport 到 body；stub 掉让内容渲染在 wrapper 内，便于查询
      stubs: { teleport: true },
    },
  })
}

// el-select 顺序：0=AI 应用 1=知识库 2=提示词 3=工作流
async function selectValue(wrapper: VueWrapper, index: number, value: string) {
  const selects = wrapper.findAllComponents({ name: 'ElSelect' })
  selects[index].vm.$emit('update:modelValue', value)
  await flushPromises()
}

async function submit(wrapper: VueWrapper) {
  await wrapper.find('[data-testid="create-session-submit"]').trigger('click')
  await flushPromises()
}

describe('CreateSessionDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    createSession.mockResolvedValue({ id: 's-1', title: 'x' })
    kbList.mockResolvedValue([{ id: 'kb-1', name: '默认知识库' }])
    promptList.mockResolvedValue([{ id: 'pt-1', name: '默认提示词' }])
    appList.mockResolvedValue([{ id: 'app-1', name: '客服助手' }])
    workflowList.mockResolvedValue([{ id: 'wf-1', name: 'ReWOO 流程', type: 'rewoo' }])
  })

  it('仅填标题即可创建，workflowType 默认 rag', async () => {
    const wrapper = mountDialog()
    await wrapper.find('input').setValue('我的会话')
    await submit(wrapper)
    expect(createSession).toHaveBeenCalledWith({ title: '我的会话', workflowType: 'rag' })
  })

  it('选择工作流后带 workflowId 与该工作流的 type', async () => {
    const wrapper = mountDialog()
    await wrapper.find('input').setValue('流程会话')
    await selectValue(wrapper, 3, 'wf-1')
    await submit(wrapper)
    expect(createSession).toHaveBeenCalledWith({
      title: '流程会话',
      workflowId: 'wf-1',
      workflowType: 'rewoo',
    })
  })

  it('选择 AI 应用后清空并禁用知识库/提示词/工作流，payload 只带 aiApplicationId', async () => {
    const wrapper = mountDialog()
    await wrapper.find('input').setValue('应用会话')
    await selectValue(wrapper, 1, 'kb-1')
    await selectValue(wrapper, 3, 'wf-1')
    await selectValue(wrapper, 0, 'app-1')
    const selects = wrapper.findAllComponents({ name: 'ElSelect' })
    expect(selects[1].props('modelValue')).toBe('')
    expect(selects[1].props('disabled')).toBe(true)
    expect(selects[2].props('disabled')).toBe(true)
    expect(selects[3].props('disabled')).toBe(true)
    await submit(wrapper)
    expect(createSession).toHaveBeenCalledWith({
      title: '应用会话',
      aiApplicationId: 'app-1',
      workflowType: 'rag',
    })
  })

  it('标题为空时校验失败，不提交', async () => {
    const wrapper = mountDialog()
    await submit(wrapper)
    expect(createSession).not.toHaveBeenCalled()
    expect(wrapper.find('.el-form-item__error').exists()).toBe(true)
  })

  it('prefillTitle 预填标题', async () => {
    const wrapper = mountDialog({ prefillTitle: '知识库问答' })
    expect((wrapper.find('input').element as HTMLInputElement).value).toBe('知识库问答')
  })

  it('选项源加载失败显示错误提示，且不阻塞仅标题创建', async () => {
    kbList.mockRejectedValue(new Error('boom'))
    const wrapper = mountDialog()
    await flushPromises()
    expect(wrapper.text()).toContain('加载失败')
    await wrapper.find('input').setValue('容错会话')
    await submit(wrapper)
    expect(createSession).toHaveBeenCalledWith({ title: '容错会话', workflowType: 'rag' })
  })
})
```

- [ ] **Step 2: 跑测试确认失败**

```bash
pnpm --filter @nexus/web test:run -- CreateSessionDialog
```

Expected: FAIL（组件不存在 / resolve 失败）。

- [ ] **Step 3: 实现 `CreateSessionDialog.vue`**

注意：useQuery 返回的是 ref 集合，模板里要用到 `isError`/`refetch` 必须在 script 里**解构**（顶层 ref 模板自动解包；`xxxQuery.isError` 这种嵌套访问在模板里不会解包，恒为 truthy——这是本组件的关键坑）。

```vue
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
  <el-dialog v-model="visible" title="新建会话" width="520px">
    <el-form ref="formRef" :model="form" :rules="rules" label-width="80px" @submit.prevent="handleSubmit">
      <el-form-item label="标题" prop="title" required>
        <el-input v-model="form.title" placeholder="会话标题" maxlength="512" />
      </el-form-item>

      <el-form-item label="AI 应用">
        <el-select
          v-model="form.aiApplicationId"
          clearable
          filterable
          placeholder="选择 AI 应用（选中后无需再选下面三项）"
          style="width: 100%"
        >
          <el-option v-for="app in aiApplications" :key="app.id" :label="app.name" :value="app.id" />
        </el-select>
        <p v-if="appsError" class="mt-1 text-xs" style="color: var(--el-color-error)">
          AI 应用加载失败
          <el-button link type="primary" size="small" @click="refetchApps()">重试</el-button>
        </p>
      </el-form-item>

      <el-form-item label="知识库">
        <el-select v-model="form.kbId" :disabled="appBound" clearable filterable placeholder="选择知识库（可选）" style="width: 100%">
          <el-option v-for="kb in knowledgeBases" :key="kb.id" :label="kb.name" :value="kb.id" />
        </el-select>
        <p v-if="kbsError" class="mt-1 text-xs" style="color: var(--el-color-error)">
          知识库加载失败
          <el-button link type="primary" size="small" @click="refetchKbs()">重试</el-button>
        </p>
      </el-form-item>

      <el-form-item label="提示词">
        <el-select v-model="form.promptTemplateId" :disabled="appBound" clearable filterable placeholder="选择提示词模板（可选）" style="width: 100%">
          <el-option v-for="pt in promptTemplates" :key="pt.id" :label="pt.name" :value="pt.id" />
        </el-select>
        <p v-if="promptsError" class="mt-1 text-xs" style="color: var(--el-color-error)">
          提示词加载失败
          <el-button link type="primary" size="small" @click="refetchPrompts()">重试</el-button>
        </p>
      </el-form-item>

      <el-form-item label="工作流">
        <el-select v-model="form.workflowId" :disabled="appBound" clearable filterable placeholder="选择工作流（可选）" style="width: 100%">
          <el-option v-for="wf in workflows" :key="wf.id" :label="`${wf.name}（${wf.type}）`" :value="wf.id" />
        </el-select>
        <p v-if="workflowsError" class="mt-1 text-xs" style="color: var(--el-color-error)">
          工作流加载失败
          <el-button link type="primary" size="small" @click="refetchWorkflows()">重试</el-button>
        </p>
      </el-form-item>
    </el-form>

    <template #footer>
      <el-button @click="visible = false">取消</el-button>
      <el-button type="primary" :loading="submitting" data-testid="create-session-submit" @click="handleSubmit">
        创建
      </el-button>
    </template>
  </el-dialog>
</template>
```

- [ ] **Step 4: 跑测试确认通过**

```bash
pnpm --filter @nexus/web test:run -- CreateSessionDialog
```

Expected: 6 个用例全 PASS。

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/modules/chat apps/web/src/modules/prompt
git commit -m "feat(chat): CreateSessionDialog 新建会话配置弹窗（AI 应用互斥 + workflowType 自动带出）"
```

---

### Task 5: 弹窗接入 ChatSessionList + 两个视图 + ChatEmptyState suggest 对象化

**Files:**
- Modify: `apps/web/src/modules/chat/components/ChatSessionList.vue`
- Modify: `apps/web/src/modules/chat/components/ChatEmptyState.vue:11,47`
- Modify: `apps/web/src/modules/chat/views/ChatList.vue`
- Modify: `apps/web/src/modules/chat/views/ChatSession.vue`
- Modify: `apps/web/src/modules/chat/__tests__/ChatEmptyState.spec.ts`

这些文件的模板/emit 类型互相耦合（移除 `new` emit、新增 `created` emit、suggest 改传对象），必须同一个任务内改完，否则 vue-tsc 报错。

- [ ] **Step 1: `ChatSessionList.vue` — 内嵌弹窗，按钮直开，`new` emit 换成 `created`**

script setup 替换为：

```ts
import { computed, ref } from 'vue'
import { Plus } from '@element-plus/icons-vue'
import dayjs from 'dayjs'
import relativeTime from 'dayjs/plugin/relativeTime'
import { useChatSessions } from '../composables/useChat'
import CreateSessionDialog from './CreateSessionDialog.vue'
import type { ChatSession } from '../types/chat'

dayjs.extend(relativeTime)

defineProps<{ activeId?: string }>()
const emit = defineEmits<{
  (e: 'select', id: string): void
  (e: 'created', session: ChatSession): void
}>()

const { data, isLoading } = useChatSessions()
const sessions = computed(() => data.value ?? [])

const dialogVisible = ref(false)
const prefillTitle = ref<string | undefined>()

function openDialog(prefill?: { title?: string }) {
  prefillTitle.value = prefill?.title
  dialogVisible.value = true
}
defineExpose({ openDialog })

function onCreated(session: ChatSession) {
  emit('created', session)
}
```

模板两处改动：

```vue
      <el-button type="primary" class="w-full" :icon="Plus" @click="openDialog()">新会话</el-button>
```

`</aside>` 闭合标签前挂载弹窗：

```vue
    <CreateSessionDialog
      v-model:visible="dialogVisible"
      :prefill-title="prefillTitle"
      @created="onCreated"
    />
  </aside>
```

- [ ] **Step 2: `ChatEmptyState.vue` — suggest 事件改传完整建议对象**

第 11 行：

```ts
const emit = defineEmits<{ (e: 'suggest', s: ChatSuggestion): void }>()
```

第 47 行按钮 click：

```vue
        @click="emit('suggest', s)"
```

（`ChatSuggestion` 已在第 4 行导入，无需新增 import。）

- [ ] **Step 3: `ChatList.vue` — 卡片点击开弹窗并预填标题，created 后跳转**

完整新文件：

```vue
<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import ChatSessionList from '../components/ChatSessionList.vue'
import ChatEmptyState from '../components/ChatEmptyState.vue'
import type { ChatSuggestion } from '../components/suggestions'
import type { ChatSession } from '../types/chat'

const router = useRouter()

// 结构式类型锁定 defineExpose 的 openDialog（不依赖 vue-tsc 对 expose 的推导版本）
const sessionListRef = ref<{ openDialog: (prefill?: { title?: string }) => void } | null>(null)

function onSelect(id: string) { router.push(`/chat/${id}`) }
// 建议卡片 = 消息引导；在欢迎页点击时只取 title 预填会话标题（修复原来 text 被丢弃的问题）
function onSuggest(s: ChatSuggestion) { sessionListRef.value?.openDialog({ title: s.title }) }
function onCreated(session: ChatSession) { router.push(`/chat/${session.id}`) }
</script>

<template>
  <div
    class="chat-island flex h-full min-h-[480px] overflow-hidden rounded-xl border"
    :style="{ borderColor: 'var(--border)', backgroundColor: 'var(--surface)' }"
  >
    <ChatSessionList ref="sessionListRef" @select="onSelect" @created="onCreated" />
    <section class="flex min-w-0 flex-1 items-center justify-center">
      <ChatEmptyState title="开始一个新的对话" @suggest="onSuggest" />
    </section>
  </div>
</template>
```

- [ ] **Step 4: `ChatSession.vue` — 新会话走弹窗，建议卡片仍直接发送**

script 改动：

```ts
// 顶部 import 增加：
import type { ChatSuggestion } from '../components/suggestions'
import type { ChatSession } from '../types/chat'

// 替换 function onNew() { router.push('/chat/new') } 为：
const sessionListRef = ref<{ openDialog: (prefill?: { title?: string }) => void } | null>(null)
function onCreated(session: ChatSession) { router.push(`/chat/${session.id}`) }

// onSuggest 签名改为对象（ChatSession 中会话已存在，卡片直接发消息）：
function onSuggest(s: ChatSuggestion) { send(s.text) }
```

模板第 87 行：

```vue
    <ChatSessionList ref="sessionListRef" :active-id="sessionId" @select="onSelect" @created="onCreated" />
```

- [ ] **Step 5: 适配 `ChatEmptyState.spec.ts`**

两处断言改为匹配对象：

```ts
  it('emits suggest with the suggestion object on card click', async () => {
    const wrapper = mount(ChatEmptyState, { props: { title: '开始一个新的对话' } })
    await wrapper.find('button').trigger('click')
    expect(wrapper.emitted('suggest')?.[0]?.[0]).toMatchObject({
      title: '知识库问答',
      text: '这个知识库包含哪些文档？',
    })
  })

  it('renders custom suggestions and emits the clicked one', async () => {
    const custom = [
      { icon: {}, title: '自定义一', text: '第一条问题' },
      { icon: {}, title: '自定义二', text: '第二条问题' },
    ]
    const wrapper = mount(ChatEmptyState, { props: { suggestions: custom } })
    const cards = wrapper.findAll('button')
    expect(cards.length).toBe(2)
    await cards[1].trigger('click')
    expect(wrapper.emitted('suggest')?.[0]?.[0]).toMatchObject({ title: '自定义二', text: '第二条问题' })
  })
```

- [ ] **Step 6: 验证**

```bash
pnpm --filter @nexus/web check-types
pnpm --filter @nexus/web test:run
```

Expected: 全部通过。

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/modules/chat
git commit -m "feat(chat): 新建弹窗接入 ChatSessionList/ChatList/ChatSession；suggest 事件传完整建议对象（修复欢迎页卡片 text 丢弃）"
```

---

### Task 6: 移除 `/chat/new` 残留（路由 redirect + headerTitle 清理）

**Files:**
- Modify: `apps/web/src/router/index.ts:41-42`
- Modify: `apps/web/src/modules/chat/views/ChatSession.vue:27-29`

- [ ] **Step 1: 路由加 redirect（直接访问 /chat/new 的旧链接兜底）**

`apps/web/src/router/index.ts` 的 children 中，在 `chat/:sessionId` 之前加一条静态路径（vue-router 静态段优先级高于动态段，顺序仅为可读性）：

```ts
      { path: 'chat', name: 'Chat', component: () => import('@/modules/chat/views/ChatList.vue') },
      { path: 'chat/new', redirect: '/chat' },
      { path: 'chat/:sessionId', name: 'ChatSession', component: () => import('@/modules/chat/views/ChatSession.vue') },
```

- [ ] **Step 2: `ChatSession.vue` 的 headerTitle 去掉 'new' 分支**

```ts
const headerTitle = computed(() => currentSession.value?.title ?? '对话')
```

- [ ] **Step 3: 全局确认无 /chat/new 残留**

```bash
grep -rn "chat/new\|'new'" apps/web/src/modules/chat apps/web/src/router --include="*.ts" --include="*.vue"
```

Expected: 只剩 router/index.ts 的 redirect 条目；无其他引用。

- [ ] **Step 4: 验证 + Commit**

```bash
pnpm --filter @nexus/web check-types
pnpm --filter @nexus/web test:run
git add -A
git commit -m "refactor(chat): 移除 /chat/new 懒创建路径，旧链接 redirect 到 /chat"
```

---

### Task 7: 全量验证

- [ ] **Step 1: web 测试 + 类型 + 构建**

```bash
pnpm --filter @nexus/web test:run
pnpm --filter @nexus/web check-types
pnpm --filter @nexus/web build
```

Expected: 全绿；vite build 成功（验证 `@nexus/config` alias 生效）。

- [ ] **Step 2: api 构建（验证 dist 消费链路）**

```bash
pnpm --filter @nexus/api build
```

Expected: nest build 成功（`@nexus/config` dist 已被 model.service.ts 消费）。

- [ ] **Step 3: 手动冒烟（可选，需后端 POST /chat/sessions 就绪）**

`pnpm dev` 后开 `http://localhost:3034/chat`：新会话按钮开弹窗 → 仅填标题创建 → 跳转 `/chat/:id` → 发消息走流式。后端端点未就绪时创建会报「创建会话失败」提示（属预期，端点由用户自行实现）。

- [ ] **Step 4: 如有修复，最终 Commit**

---

## Self-Review 记录

- **Spec 覆盖**：§1 公共包 → Task 1/2；§2 弹窗 → Task 4；§3 数据流/集成 → Task 5/6；§4 错误处理 → Task 4（选项失败不阻塞、ElMessage、rules）；§5 测试 → Task 4 spec + Task 5 Step 5 + Task 2/7 回归验证；§6 后端提醒 → 不在范围，Task 7 Step 3 注明。
- **类型一致性**：`openDialog(prefill?: { title?: string })`（Task 5 Step 1 defineExpose）与两个视图 ref 结构式类型一致；`CreateSessionPayload`（Task 3 Step 1）与弹窗 payload 构造（Task 4 Step 3）字段一致；`useCreateChatSession`（Task 3）与弹窗使用（Task 4）一致；enabled 参数签名三处一致。
- **已知顺序约束**：Task 3 改 createSession 签名后、Task 5 前，「新会话」按钮仍跳 /chat/new 且 send() 不再创建会话——中间态该入口不可用，但每个 commit 的构建与测试保持绿色，功能在 Task 5 闭合。
