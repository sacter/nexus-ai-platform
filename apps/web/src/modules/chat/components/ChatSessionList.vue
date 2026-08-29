<script setup lang="ts">
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
</script>

<template>
  <aside class="flex h-full w-[260px] flex-col border-r" :style="{ borderColor: 'var(--border)', backgroundColor: 'var(--surface-secondary)' }">
    <div class="p-3">
      <el-button type="primary" class="w-full" :icon="Plus" @click="openDialog()">新会话</el-button>
    </div>

    <div class="flex-1 overflow-y-auto px-2 pb-2">
      <template v-if="isLoading">
        <div v-for="i in 5" :key="i" class="px-3 py-3">
          <el-skeleton :rows="2" animated />
        </div>
      </template>

      <el-empty v-else-if="sessions.length === 0" description="暂无会话" />

      <ul v-else class="space-y-1">
        <li
          v-for="s in sessions"
          :key="s.id"
          class="session-item cursor-pointer rounded-lg px-3 py-2"
          :class="{ active: s.id === activeId }"
          @click="emit('select', s.id)"
        >
          <div class="flex items-center justify-between gap-2">
            <span class="truncate text-sm font-medium" :style="{ color: 'var(--foreground)' }">{{ s.title }}</span>
            <el-tag v-if="s.workflowType" size="small" effect="plain">{{ s.workflowType }}</el-tag>
          </div>
          <div class="mt-0.5 flex items-center justify-between text-[11px] opacity-60" :style="{ color: 'var(--foreground)' }">
            <span class="truncate">{{ s.lastMessage?.content ?? '新会话' }}</span>
            <span>{{ s.createdAt ? dayjs(s.createdAt).fromNow() : '' }}</span>
          </div>
        </li>
      </ul>
    </div>
    <CreateSessionDialog
      v-model:visible="dialogVisible"
      :prefill-title="prefillTitle"
      @created="onCreated"
    />
  </aside>
</template>

<style scoped>
.session-item {
  transition: background-color var(--dur-fast) ease,
              box-shadow var(--dur-fast) ease;
}
.session-item:hover {
  background-color: color-mix(in oklch, var(--accent) 5%, transparent);
}
/* active: accent-soft 底 + 左侧 2px accent 指示条 */
.session-item.active {
  background-color: var(--accent-soft);
  box-shadow: inset 2px 0 0 var(--accent);
}
</style>
