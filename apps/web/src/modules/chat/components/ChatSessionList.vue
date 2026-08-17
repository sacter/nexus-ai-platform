<script setup lang="ts">
import { computed } from 'vue'
import { Plus } from '@element-plus/icons-vue'
import dayjs from 'dayjs'
import relativeTime from 'dayjs/plugin/relativeTime'
import { useChatSessions } from '../composables/useChat'

dayjs.extend(relativeTime)

defineProps<{ activeId?: string }>()
const emit = defineEmits<{ (e: 'select', id: string): void; (e: 'new'): void }>()

const { data, isLoading } = useChatSessions()
const sessions = computed(() => data.value ?? [])
</script>

<template>
  <aside class="flex h-full w-[260px] flex-col border-r" :style="{ borderColor: 'var(--border)' }">
    <div class="p-3">
      <el-button type="primary" class="w-full" :icon="Plus" @click="emit('new')">新会话</el-button>
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
          class="group cursor-pointer rounded-lg px-3 py-2 transition-colors"
          :style="s.id === activeId
            ? { backgroundColor: 'var(--accent-soft)' }
            : {}"
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
  </aside>
</template>
