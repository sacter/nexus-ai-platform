<script setup lang="ts">
defineProps<{
  role: 'user' | 'assistant'
  content: string
}>()
</script>

<template>
  <div
    class="flex gap-3 py-2 message-enter"
    :class="role === 'user' ? 'flex-row-reverse' : ''"
  >
    <div
      class="max-w-[70%] rounded-lg px-4 py-2 text-sm"
      :style="role === 'user'
        ? { backgroundColor: 'var(--accent)', color: 'white' }
        : { backgroundColor: 'var(--surface)', color: 'var(--foreground)', border: '1px solid var(--border)' }"
    >
      {{ content }}
    </div>
  </div>
</template>

<style scoped>
/* 气泡入场 */
.message-enter-active {
  transition: opacity 200ms ease-out, transform 200ms ease-out;
}
.message-enter-from {
  opacity: 0;
  transform: translateY(6px);
}
</style>
