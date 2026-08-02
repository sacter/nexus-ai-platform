<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { Plus } from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { useQueries } from '@tanstack/vue-query'
import { useKnowledgeBases, useDeleteKnowledgeBase } from '@/modules/knowledge/composables/useKnowledge'
import { permissionsApi } from '@/modules/knowledge/api/permission.api'
import KbCard from '@/modules/knowledge/components/KnowledgeCard.vue'
import KbCreateDialog from '@/modules/knowledge/components/KnowledgeCreateDialog.vue'
import type { KnowledgeBase } from '@/modules/knowledge/types/knowledge'
import type { KbPermission } from '@/modules/knowledge/types/permission'

const router = useRouter()
const { data: kbs, isLoading } = useKnowledgeBases()
const deleteMutation = useDeleteKnowledgeBase()

/* ---------- 批量查询当前用户对各 KB 的权限 ---------- */
const permQueries = useQueries({
  queries: computed(() =>
    ((kbs.value as KnowledgeBase[]) ?? []).map((kb) => ({
      queryKey: ['knowledge-base', kb.id, 'permissions', 'me'] as const,
      queryFn: () => permissionsApi.myPermission(kb.id),
      enabled: Array.isArray(kbs.value),
    })),
  ),
})

const myRoleMap = computed(() => {
  const map: Record<string, string | null> = {}
  const list = (kbs.value as KnowledgeBase[]) ?? []
  list.forEach((kb, i) => {
    map[kb.id] = (permQueries.value[i]?.data as KbPermission)?.role ?? null
  })
  return map
})

const createDialogVisible = ref(false)

// 查看和编辑共用同一入口，都进入知识库详情页（详情页内可编辑）
function handleView(id: string) {
  router.push(`/knowledge-bases/${id}`)
}

function handleDelete(id: string, isActive: boolean) {
  // 开启中的知识库不允许直接删除
  if (isActive) {
    ElMessage.warning('知识库开启中，请先确认关闭再执行此操作！')
    return
  }
  ElMessageBox.confirm('是否确定删除该知识库？', '提示', {
    confirmButtonText: '确定',
    cancelButtonText: '取消',
    type: 'warning',
  })
    .then(() => {
      deleteMutation.mutate(id)
    })
    .catch(() => {
      // 用户取消删除
    })
}
</script>

<template>
  <div class="flex items-center justify-between">
    <h3 class="text-xl font-semibold" style="color: var(--foreground)">知识库</h3>
    <el-button type="primary" :icon="Plus" @click="createDialogVisible = true">创建知识库</el-button>
  </div>

  <!-- 加载骨架屏 -->
  <div v-if="isLoading" class="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
    <el-skeleton v-for="i in 6" :key="i" animated>
      <template #template>
        <el-skeleton-item variant="rect" style="height: 120px; border-radius: 8px" />
      </template>
    </el-skeleton>
  </div>

  <div
    v-else-if="kbs && Array.isArray(kbs) && kbs.length > 0"
    class="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 mt-4"
  >
    <KbCard
      v-for="kb in kbs"
      :id="(kb as KnowledgeBase).id"
      :key="(kb as KnowledgeBase).id"
      :name="(kb as KnowledgeBase).name"
      :description="(kb as KnowledgeBase).description"
      :creator-name="(kb as KnowledgeBase).createdByUser?.username"
      :created-at="(kb as KnowledgeBase).createdAt"
      :is-active="(kb as KnowledgeBase).isActive"
      :user-role="myRoleMap[(kb as KnowledgeBase).id]"
      @view="handleView"
      @delete="handleDelete"
    />
  </div>

  <el-empty v-else description="暂无知识库" />

  <KbCreateDialog v-model:visible="createDialogVisible" />
</template>
