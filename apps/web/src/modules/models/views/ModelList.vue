<script setup lang="ts">
import { Plus, Coin } from '@element-plus/icons-vue'
import { useModels, useDeleteModel } from '@/modules/models/composables/useModels'
import ModelCard from '@/modules/models/components/ModelCard.vue'
const { data: models, isLoading } = useModels()
const deleteMutation = useDeleteModel()
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
            <Coin />
          </el-icon>
        </div>
        <div>
          <h1
            class="font-display text-2xl font-bold tracking-tight"
            style="color: var(--foreground)"
          >
            模型
          </h1>
          <p
            class="mt-0.5 text-xs"
            style="color: var(--foreground); opacity: 0.55"
          >
            注册模型并配置各 Provider 接入
          </p>
        </div>
      </div>
      <el-button
        type="primary"
        :icon="Plus"
      >
        添加模型
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
      v-else-if="models && Array.isArray(models) && models.length > 0"
      class="grid grid-cols-3 gap-[11.2px]"
    >
      <ModelCard
        v-for="m in models"
        :id="(m as any).id"
        :key="(m as any).id"
        :name="(m as any).name"
        :provider="(m as any).provider"
        :type="(m as any).type"
        @delete="handleDelete"
      />
    </div>
    <el-empty
      v-else
      description="暂无模型"
    />
  </div>
</template>
