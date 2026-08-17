<script setup lang="ts">
import { ref, nextTick, onMounted } from 'vue'
import { Promotion, VideoPause } from '@element-plus/icons-vue'

const props = defineProps<{ streaming?: boolean }>()
const emit = defineEmits<{
  (e: 'send', content: string): void
  (e: 'stop'): void
}>()

const content = ref('')
const textareaRef = ref<HTMLTextAreaElement | null>(null)

function autosize() {
  const el = textareaRef.value
  if (!el) return
  el.style.height = 'auto'
  el.style.height = Math.min(el.scrollHeight, 168) + 'px'
}

async function onInput() {
  await nextTick()
  autosize()
}

function onEnter(e: KeyboardEvent) {
  if (props.streaming) return
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault()
    submit()
  }
}

function submit() {
  const text = content.value.trim()
  if (!text || props.streaming) return
  emit('send', text)
  content.value = ''
  nextTick(autosize)
}

onMounted(() => autosize())
</script>

<template>
  <div
    class="flex items-end gap-2 border-t p-3"
    :style="{ borderColor: 'var(--border)', backgroundColor: 'var(--surface)' }"
  >
    <textarea
      ref="textareaRef"
      v-model="content"
      rows="1"
      placeholder="输入问题，Enter 发送，Shift+Enter 换行"
      class="flex-1 resize-none rounded-lg px-3 py-2 text-sm outline-none"
      :style="{
        backgroundColor: 'var(--surface-secondary)',
        color: 'var(--foreground)',
        border: '1px solid var(--border)',
      }"
      :disabled="streaming"
      @input="onInput"
      @keydown="onEnter"
    />
    <button
      v-if="!streaming"
      class="flex h-9 w-9 items-center justify-center rounded-lg text-white transition-opacity disabled:opacity-40"
      :style="{ backgroundColor: 'var(--accent)' }"
      :disabled="!content.trim()"
      @click="submit"
    >
      <el-icon :size="16"><Promotion /></el-icon>
    </button>
    <button
      v-else
      data-testid="stop-btn"
      class="flex h-9 w-9 items-center justify-center rounded-lg"
      :style="{ backgroundColor: 'var(--accent-soft)', color: 'var(--accent)' }"
      @click="emit('stop')"
    >
      <el-icon :size="16"><VideoPause /></el-icon>
    </button>
  </div>
</template>
