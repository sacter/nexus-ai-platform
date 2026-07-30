<script setup lang="ts">
defineProps<{
  title: string
  subtitle?: string
}>()
</script>

<template>
  <div class="min-h-screen flex items-center justify-center p-4" style="background-color: var(--surface-secondary)">
    <div class="w-full max-w-md p-8 rounded-xl shadow-sm" style="background-color: var(--surface); border: 1px solid var(--border)">
      <div class="text-center mb-6">
        <h1 class="text-2xl font-bold" style="color: var(--foreground)">{{ title }}</h1>
        <p v-if="subtitle" class="text-sm mt-2" style="color: var(--foreground); opacity: 0.6">{{ subtitle }}</p>
      </div>
      <slot />
    </div>
  </div>
</template>
