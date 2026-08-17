<script setup lang="ts">
const props = defineProps<{ title?: string; suggestions?: string[] }>()
const emit = defineEmits<{ (e: 'suggest', text: string): void }>()
const fallback = ['这个知识库包含哪些文档？', '请帮我总结最新的规定', '常见问题有哪些？']
const list = props.suggestions?.length ? props.suggestions : fallback
</script>

<template>
  <div class="flex h-full flex-col items-center justify-center gap-3 px-6 text-center">
    <h2 class="text-lg font-semibold" :style="{ color: 'var(--foreground)' }">
      {{ title ?? '开始对话' }}
    </h2>
    <p class="text-sm opacity-60" :style="{ color: 'var(--foreground)' }">
      输入问题，或试试以下建议：
    </p>
    <div class="flex flex-wrap justify-center gap-2">
      <button
        v-for="s in list"
        :key="s"
        class="rounded-full border px-3 py-1 text-xs transition-colors hover:bg-[var(--accent-soft)]"
        :style="{ borderColor: 'var(--border)', color: 'var(--foreground)' }"
        @click="emit('suggest', s)"
      >{{ s }}</button>
    </div>
  </div>
</template>
