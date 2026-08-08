<script setup lang="ts">
import { ref } from 'vue'

const emit = defineEmits<{
  send: [content: string]
}>()

const content = ref('')

function handleSend() {
  if (!content.value.trim()) return
  emit('send', content.value)
  content.value = ''
}
</script>

<template>
  <div
    class="border-t p-4 flex gap-2"
    style="border-color: var(--border); background-color: var(--surface)"
  >
    <el-input
      v-model="content"
      placeholder="输入消息..."
      class="flex-1"
      @keyup.enter="handleSend"
    />
    <el-button
      type="primary"
      @click="handleSend"
    >
      发送
    </el-button>
  </div>
</template>
