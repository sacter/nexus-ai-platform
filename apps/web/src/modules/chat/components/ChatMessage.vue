<script setup lang="ts">
defineProps<{
  role: 'user' | 'assistant'
  content: string
}>()
</script>

<template>
  <div
    class="flex gap-3 py-2"
    :class="role === 'user' ? 'flex-row-reverse' : ''"
  >
    <div
      class="max-w-[70%] rounded-lg px-4 py-2 text-sm"
      :style="role === 'user'
        ? { backgroundColor: 'var(--accent)', color: 'white' }
        : { backgroundColor: 'var(--surface-secondary)', color: 'var(--foreground)' }"
    >
      {{ content }}
    </div>
  </div>
</template>
