<script setup lang="ts">
import { ref } from 'vue'
import type { Citation } from '../types/chat'

defineProps<{ citations: Citation[] }>()
const expanded = ref(false)
</script>

<template>
  <div v-if="citations.length" class="mt-2">
    <button
      data-testid="citations-toggle"
      type="button"
      :aria-expanded="expanded"
      class="inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 text-xs transition-colors"
      :style="{
        backgroundColor: expanded ? 'var(--accent-soft)' : 'var(--surface-secondary)',
        color: 'var(--foreground)',
        borderColor: 'var(--border)',
      }"
      @click="expanded = !expanded"
    >
      <span>📎 {{ citations.length }} 条来源</span>
      <span>{{ expanded ? '▴' : '▾' }}</span>
    </button>

    <ol v-if="expanded" class="mt-2 space-y-1.5">
      <li
        v-for="(c, i) in citations"
        :key="i"
        class="rounded-md border px-2.5 py-1.5 text-xs"
        :style="{ backgroundColor: 'var(--surface-secondary)', borderColor: 'var(--border)' }"
      >
        <div class="flex items-center justify-between gap-2" :style="{ color: 'var(--foreground)' }">
          <span class="font-medium">{{ i + 1 }}. {{ c.documentName }}<span v-if="c.page"> · p{{ c.page }}</span></span>
          <span v-if="c.score != null" class="font-mono text-[10px] opacity-60">{{ c.score.toFixed(2) }}</span>
        </div>
        <p v-if="c.snippet" class="mt-0.5 line-clamp-2 opacity-70">{{ c.snippet }}</p>
      </li>
    </ol>
  </div>
</template>
