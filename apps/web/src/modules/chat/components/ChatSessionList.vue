<script setup lang="ts">
import { Plus, ChatDotRound } from '@element-plus/icons-vue'
import { useChatSessions } from '@/modules/chat/composables/useChat'

defineProps<{
  activeId?: string
}>()

const emit = defineEmits<{
  select: [id: string]
  new: []
}>()

const { data: sessions, isLoading } = useChatSessions()
</script>

<template>
  <div
    class="w-60 shrink-0 border-r h-full flex flex-col"
    style="border-color: var(--border); background-color: var(--surface)"
  >
    <div
      class="p-3 border-b"
      style="border-color: var(--border)"
    >
      <el-button
        :icon="Plus"
        size="small"
        type="primary"
        plain
        class="w-full"
        @click="emit('new')"
      >
        新建对话
      </el-button>
    </div>
    <div class="flex-1 overflow-y-auto p-2">
      <div
        v-if="isLoading"
        class="flex flex-col gap-2"
      >
        <el-skeleton
          v-for="i in 5"
          :key="i"
          animated
        >
          <template #template>
            <el-skeleton-item
              variant="rect"
              style="height: 36px; border-radius: 8px"
            />
          </template>
        </el-skeleton>
      </div>
      <div
        v-else-if="sessions && Array.isArray(sessions) && sessions.length > 0"
        class="flex flex-col gap-0.5"
      >
        <button
          v-for="s in sessions"
          :key="s.id"
          class="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-left w-full transition-colors"
          :class="s.id === activeId ? 'bg-accent/10 text-accent' : 'text-foreground/60 hover:bg-surface-secondary'"
          @click="emit('select', s.id)"
        >
          <el-icon :size="14">
            <ChatDotRound />
          </el-icon>
          <span class="truncate">{{ s.title || '对话' }}</span>
        </button>
      </div>
      <el-empty
        v-else
        description="暂无对话"
        :image-size="40"
      />
    </div>
  </div>
</template>
