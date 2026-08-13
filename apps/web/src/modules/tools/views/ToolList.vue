<script setup lang="ts">
import { Plus } from '@element-plus/icons-vue'
import { useTools, useDeleteTool } from '@/modules/tools/composables/useTools'
import ToolCard from '@/modules/tools/components/ToolCard.vue'
const { data: tools, isLoading } = useTools()
const deleteMutation = useDeleteTool()
function handleDelete(id: string) { deleteMutation.mutate(id) }
</script>
<template>
  <div>
    <div class="flex items-center justify-between mb-6">
      <h1
        class="text-2xl font-semibold"
        style="color: var(--foreground)"
      >
        工具
      </h1>
      <el-button
        type="primary"
        :icon="Plus"
      >
        添加工具
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
      v-else-if="tools && Array.isArray(tools) && tools.length > 0"
      class="grid grid-cols-3 gap-[11.2px]"
    >
      <ToolCard
        v-for="t in tools"
        :id="(t as any).id"
        :key="(t as any).id"
        :name="(t as any).name"
        :description="(t as any).description"
        :type="(t as any).type"
        @delete="handleDelete"
      />
    </div>
    <el-empty
      v-else
      description="暂无工具"
    />
  </div>
</template>
