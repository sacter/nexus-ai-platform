<script setup lang="ts">
import { ref } from 'vue'
import { Paperclip, ArrowDown, ArrowUp } from '@element-plus/icons-vue'
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
      class="inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs transition-colors cursor-pointer"
      :style="{
        backgroundColor: expanded ? 'var(--accent-soft)' : 'var(--surface-secondary)',
        color: 'var(--foreground)',
        borderColor: 'var(--border)',
      }"
      @click="expanded = !expanded"
    >
      <el-icon :size="12"><Paperclip /></el-icon>
      <span>{{ citations.length }} 条来源</span>
      <el-icon :size="12"><ArrowUp v-if="expanded" /><ArrowDown v-else /></el-icon>
    </button>

    <ol v-if="expanded" class="mt-2 space-y-1.5">
      <li
        v-for="(c, i) in citations"
        :key="i"
        class="citation-item rounded-md border px-2.5 py-1.5 text-xs"
        :style="{ backgroundColor: 'var(--surface-secondary)', borderColor: 'var(--border)' }"
      >
        <div class="flex items-center justify-between gap-2" :style="{ color: 'var(--foreground)' }">
          <span class="font-medium">{{ i + 1 }}. {{ c.documentName }}<span v-if="c.page"> · p{{ c.page }}</span></span>
          <span v-if="c.score != null" class="num text-[10px] opacity-60">{{ c.score.toFixed(2) }}</span>
        </div>
        <p v-if="c.snippet" class="mt-0.5 line-clamp-2 opacity-70" :style="{ color: 'var(--foreground)' }">{{ c.snippet }}</p>
      </li>
    </ol>
  </div>
</template>

<style scoped>
.citation-item {
  transition: background-color var(--dur-fast) ease;
}
.citation-item:hover {
  background-color: var(--accent-soft);
}
</style>
