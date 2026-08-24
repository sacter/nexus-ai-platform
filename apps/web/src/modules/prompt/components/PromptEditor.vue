<script setup lang="ts">
import { computed, ref } from 'vue'
import { highlightSegments } from '../utils/prompt-variables'

/**
 * 提示词编辑器（本模块签名元素）。
 * underlay-mirror 技术：透明 textarea 盖在高亮镜像层上 —— 输入体验是原生
 * textarea（可编辑/选区/撤销），视觉上的 {{变量}} 以 accent 令牌渲染；
 * 两层共享同一等宽字形与排版参数，滚动由 textarea 同步到镜像层。
 * readonly（历史版本预览）时只渲染镜像层。
 */
const props = withDefaults(
  defineProps<{
    modelValue: string
    placeholder?: string
    readonly?: boolean
    rows?: number
  }>(),
  { placeholder: '', readonly: false, rows: 18 },
)

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()

const textareaRef = ref<HTMLTextAreaElement>()
const mirrorRef = ref<HTMLElement>()

const segments = computed(() => highlightSegments(props.modelValue))

function onInput(e: Event) {
  emit('update:modelValue', (e.target as HTMLTextAreaElement).value)
}

function syncScroll() {
  const ta = textareaRef.value
  const mirror = mirrorRef.value
  if (!ta || !mirror) return
  mirror.scrollTop = ta.scrollTop
  mirror.scrollLeft = ta.scrollLeft
}
</script>

<template>
  <div
    class="prompt-editor"
    :class="{ 'prompt-editor--readonly': readonly }"
    :style="{ '--editor-rows': rows }"
  >
    <!-- 高亮镜像层（参与交互：被 textarea 透明覆盖，纯展示） -->
    <div
      ref="mirrorRef"
      class="editor-layer mirror"
      aria-hidden="true"
    >
      <template
        v-for="(seg, i) in segments"
        :key="i"
      >
        <span
          v-if="seg.isVar"
          class="var-token"
        >{{ seg.text }}</span>
        <span v-else>{{ seg.text }}</span>
      </template>
      <!-- 末尾换行占位，保持与 textarea 滚动高度一致 -->
      <span>&#10;</span>
    </div>
    <textarea
      v-if="!readonly"
      ref="textareaRef"
      class="editor-layer input"
      :value="modelValue"
      :placeholder="placeholder"
      spellcheck="false"
      @input="onInput"
      @scroll="syncScroll"
    />
  </div>
</template>

<style scoped>
.prompt-editor {
  position: relative;
  overflow: hidden;
  border: 1px solid var(--border);
  border-radius: 10px;
  background: var(--surface-secondary);
  transition: border-color 0.15s ease, box-shadow 0.15s ease;
}
.prompt-editor:focus-within {
  border-color: var(--accent);
  box-shadow: 0 0 0 2px color-mix(in oklch, var(--accent) 25%, transparent);
}

.editor-layer {
  box-sizing: border-box;
  width: 100%;
  height: calc(var(--editor-rows) * 1.65em + 24px);
  padding: 12px 14px;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 13px;
  line-height: 1.65em;
  white-space: pre-wrap;
  overflow-wrap: break-word;
}

.mirror {
  overflow: hidden;
  color: var(--foreground);
}

.input {
  position: absolute;
  inset: 0;
  overflow: auto;
  resize: none;
  border: none;
  outline: none;
  background: transparent;
  /* 文字透明、光标可见：高亮完全交给镜像层 */
  color: transparent;
  caret-color: var(--foreground);
}
.input::placeholder {
  color: color-mix(in oklch, var(--foreground) 35%, transparent);
}

.var-token {
  color: var(--accent);
  background: color-mix(in oklch, var(--accent) 14%, transparent);
  border-radius: 4px;
  padding: 0 2px;
}

.prompt-editor--readonly .mirror {
  overflow: auto;
}

@media (prefers-reduced-motion: reduce) {
  .prompt-editor {
    transition: none;
  }
}
</style>
