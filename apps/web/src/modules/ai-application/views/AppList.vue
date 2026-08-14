<script setup lang="ts">
import { useRouter } from 'vue-router'
import { Plus, Cpu } from '@element-plus/icons-vue'
import { useAiApplications, useDeleteAiApplication } from '@/modules/ai-application/composables/useAiApplications'
import AppCard from '@/modules/ai-application/components/AppCard.vue'

const router = useRouter()
const { data: apps, isLoading } = useAiApplications()
const deleteMutation = useDeleteAiApplication()

function handleView(id: string) { router.push(`/ai-applications/${id}`) }
function handleDelete(id: string) { deleteMutation.mutate(id) }
</script>

<template>
  <div>
    <div class="mb-6 flex items-center justify-between">
      <div class="flex items-center gap-3">
        <div
          class="flex h-10 w-10 items-center justify-center rounded-xl shrink-0"
          style="background: var(--brand-gradient); box-shadow: 0 8px 20px -8px color-mix(in oklch, var(--accent) 55%, transparent)"
        >
          <el-icon
            :size="18"
            color="#fff"
          >
            <Cpu />
          </el-icon>
        </div>
        <div>
          <h1
            class="font-display text-2xl font-bold tracking-tight"
            style="color: var(--foreground)"
          >
            AI 应用
          </h1>
          <p
            class="mt-0.5 text-xs"
            style="color: var(--foreground); opacity: 0.55"
          >
            编排模型、知识库与工具，构建智能应用
          </p>
        </div>
      </div>
      <el-button
        type="primary"
        :icon="Plus"
        @click="router.push('/ai-applications/new')"
      >
        创建应用
      </el-button>
    </div>

    <div
      v-if="isLoading"
      class="grid grid-cols-3 gap-[11.2px]"
    >
      <el-skeleton
        v-for="i in 6"
        :key="i"
        animated
      >
        <template #template>
          <el-skeleton-item
            variant="rect"
            style="height: 110px; border-radius: 12px"
          />
        </template>
      </el-skeleton>
    </div>

    <div
      v-else-if="apps && Array.isArray(apps) && apps.length > 0"
      class="grid grid-cols-3 gap-[11.2px]"
    >
      <AppCard
        v-for="app in apps"
        :id="(app as Record<string,string>).id"
        :key="(app as Record<string,string>).id"
        :name="(app as Record<string,string>).name"
        @view="handleView"
        @delete="handleDelete"
      />
    </div>

    <el-empty
      v-else
      description="暂无 AI 应用"
    />
  </div>
</template>
