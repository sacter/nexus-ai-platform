<script setup lang="ts">
import { ref, watch, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Upload, Search, MoreFilled, Document } from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { useKnowledgeBase, useDeleteKnowledgeBase, useUpdateKnowledgeBase } from '@/modules/knowledge/composables/useKnowledge'
import { useMyPermission } from '@/modules/knowledge/composables/usePermissions'
import { useBreadcrumbStore } from '@/stores/breadcrumb'
import DocumentList from '@/modules/knowledge/views/DocumentList.vue'
import ChunkDetail from '@/modules/knowledge/components/ChunkDetail.vue'
import DocumentUpload from '@/modules/knowledge/components/DocumentUpload.vue'
import KnowledgeCreateDialog from '@/modules/knowledge/components/KnowledgeCreateDialog.vue'
import PermissionDialog from '@/modules/knowledge/components/PermissionDialog.vue'
import { EMBEDDING_MODEL_OPTIONS, type KnowledgeBase } from '@/modules/knowledge/types/knowledge'
import type { Document as DocType } from '@/modules/knowledge/types/document'
import type { KbPermission } from '@/modules/knowledge/types/permission'
import { formatDate } from '@/utils/format'

const route = useRoute()
const router = useRouter()
const kbId = route.params.kbId as string
const { data: kb, isLoading: kbLoading } = useKnowledgeBase(kbId)

const deleteKbMutation = useDeleteKnowledgeBase()
const updateKbMutation = useUpdateKnowledgeBase()
const breadcrumb = useBreadcrumbStore()

const uploadDialogVisible = ref(false)
const editDialogVisible = ref(false)
const permissionDialogVisible = ref(false)
const embeddingDialogVisible = ref(false)
const embeddingSubmitting = ref(false)
const embeddingModel = ref('bge-m3')
const activeTab = ref('documents')
// 切片 tab 文档选择（受控）：'' = 全部
const chunkDocId = ref('')
// 区分「切片详情」触发 vs 直接点 tab：前者不重置选择
const suppressReset = ref(false)

watch(activeTab, (tab) => {
  if (tab === 'chunks' && !suppressReset.value) {
    chunkDocId.value = ''
  }
  suppressReset.value = false
})
const searchQuery = ref('')

/* ---------- 当前用户对该 KB 的权限 ---------- */
const { data: myPerm } = useMyPermission(kbId)
const myRole = computed(() => (myPerm.value as KbPermission)?.role ?? null)
const canEdit = computed(() => myRole.value === 'admin')
const canDelete = computed(() => myRole.value === 'admin')
const canManagePermissions = computed(() => myRole.value === 'admin')
const canUpload = computed(() => myRole.value === 'admin' || myRole.value === 'editor')

watch(() => (kb.value as KnowledgeBase)?.name, (name) => {
  if (name) breadcrumb.setLabels({ [kbId]: name })
}, { immediate: true })

function handleDeleteKb() {
  // 知识库开启中不允许直接删除
  if ((kb.value as KnowledgeBase)?.isActive) {
    ElMessage.warning('知识库开启中，请先确认关闭再执行此操作！')
    return
  }
  ElMessageBox.confirm('是否确定删除该知识库？', '提示', {
    confirmButtonText: '确定',
    cancelButtonText: '取消',
    type: 'warning',
  })
    .then(() => {
      deleteKbMutation.mutate(kbId, {
        onSuccess: () => router.push('/knowledge-bases'),
      })
    })
    .catch(() => {
      // 用户取消删除
    })
}

function handleViewChunks(row: DocType) {
  suppressReset.value = true
  chunkDocId.value = row.id
  activeTab.value = 'chunks'
}

function openEmbeddingDialog() {
  embeddingModel.value = (kb.value as KnowledgeBase)?.embeddingModel || 'bge-m3'
  embeddingDialogVisible.value = true
}

async function handleSaveEmbedding() {
  embeddingSubmitting.value = true
  try {
    await updateKbMutation.mutateAsync({
      id: kbId,
      data: { embeddingModel: embeddingModel.value },
    })
    ElMessage.success('Embedding 模型已更新')
    embeddingDialogVisible.value = false
  } finally {
    embeddingSubmitting.value = false
  }
}

</script>

<template>
  <div>
    <!-- Header -->
    <div v-if="kbLoading" class="flex justify-center py-12">
      <el-icon class="is-loading" :size="24"><Document /></el-icon>
    </div>

    <template v-else-if="kb">
      <el-card class="mb-2">
        <div class="flex items-start justify-between">
          <div class="flex items-start gap-4">
            <div class="w-12 h-14 rounded-xl flex items-center justify-center shrink-0"
              style="background: linear-gradient(135deg, var(--el-color-primary-light-5), var(--el-color-primary))">
              <el-icon :size="28" color="#fff"><Document /></el-icon>
            </div>
            <div>
              <div class="flex items-center gap-3 mb-1">
                <h1 class="text-xl font-bold" style="color: var(--foreground)">
                  {{ (kb as KnowledgeBase).name }}
                </h1>
                <el-tag :type="(kb as KnowledgeBase).isActive ? 'success' : 'info'" size="small">
                  {{ (kb as KnowledgeBase).isActive ? '开启中' : '未开启' }}
                </el-tag>
              </div>
              <div class="flex flex-wrap items-center gap-x-6 gap-y-1 text-xs" style="color: var(--foreground); opacity: 0.4">
                <span>创建人: <span style="opacity: 0.7; font-family: monospace">{{ (kb as KnowledgeBase)?.createdByUser?.username }}</span></span>
                <span>创建时间: <span style="opacity: 0.7">{{ formatDate((kb as KnowledgeBase).createdAt, 'yyyy-mm-dd') || '--' }}</span></span>
                <span>更新时间: <span style="opacity: 0.7">{{ formatDate((kb as KnowledgeBase).updatedAt) || '--' }}</span></span>
              </div>
              <div v-if="(kb as KnowledgeBase).description" class="mt-3 text-sm" style="color: var(--foreground); opacity: 0.7">
                {{ (kb as KnowledgeBase).description }}
              </div>
            </div>
          </div>
          <el-dropdown trigger="click" v-if="canEdit || canManagePermissions || canDelete">
            <el-button :icon="MoreFilled" circle />
            <template #dropdown>
              <el-dropdown-menu>
                <el-dropdown-item v-if="canEdit" @click="editDialogVisible = true">编辑知识库</el-dropdown-item>
                <el-dropdown-item v-if="canManagePermissions" @click="permissionDialogVisible = true">权限管理</el-dropdown-item>
                <el-dropdown-item v-if="canDelete" style="color: var(--el-color-danger)" @click="handleDeleteKb">
                  删除知识库
                </el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>
        </div>
      </el-card>

      <!-- Tabs -->
      <el-card>
        <el-tabs v-model="activeTab">
          <el-tab-pane label="原始文档" name="documents">
            <div class="mt-4">
              <div class="flex items-center justify-between mb-4">
                <el-button v-if="canUpload" type="primary" :icon="Upload" @click="uploadDialogVisible = true">
                  上传文档
                </el-button>
                <div class="flex items-center gap-2">
                  <el-input
                    v-model="searchQuery"
                    placeholder="搜索文档名称"
                    :prefix-icon="Search"
                    style="width: 220px"
                  />
                </div>
              </div>

              <DocumentList
                :kb-id="kbId"
                embedded
                :can-edit="canEdit"
                @view-chunks="handleViewChunks"
                @embedding="openEmbeddingDialog"
              />
            </div>
          </el-tab-pane>

          <el-tab-pane label="切片详情" name="chunks">
            <ChunkDetail
              :kb-id="kbId"
              :document-id="chunkDocId"
              @update:document-id="chunkDocId = $event"
            />
          </el-tab-pane>

          <el-tab-pane label="知识检索" name="search">
            <div class="flex items-center justify-center py-20">
              <div class="text-center">
                <p class="text-sm" style="color: var(--foreground); opacity: 0.6">请先导入文档以启用知识检索</p>
              </div>
            </div>
          </el-tab-pane>

          <el-tab-pane label="知识问答" name="qa">
            <div class="flex items-center justify-center py-20">
              <div class="text-center">
                <p class="text-sm" style="color: var(--foreground); opacity: 0.6">请先导入文档以启用知识问答</p>
              </div>
            </div>
          </el-tab-pane>
        </el-tabs>
      </el-card>

      <!-- Upload Dialog -->
      <el-dialog v-model="uploadDialogVisible" title="上传文档" width="800px">
        <DocumentUpload :kb-id="kbId" />
      </el-dialog>

      <!-- Edit Dialog -->
      <KnowledgeCreateDialog v-model:visible="editDialogVisible" :kb="(kb as KnowledgeBase)" />

      <!-- Embedding Dialog -->
      <el-dialog v-model="embeddingDialogVisible" title="Embedding 配置" width="480px">
        <el-form @submit.prevent="handleSaveEmbedding">
          <el-form-item label="Embedding" required>
            <el-select v-model="embeddingModel" style="width: 100%">
              <el-option
                v-for="opt in EMBEDDING_MODEL_OPTIONS"
                :key="opt.value"
                :label="opt.label"
                :value="opt.value"
              />
            </el-select>
          </el-form-item>
          <div class="text-xs" style="color: var(--foreground); opacity: 0.5">
            修改 Embedding 模型后，知识库内的文档需要重新向量化处理。
          </div>
        </el-form>
        <template #footer>
          <el-button @click="embeddingDialogVisible = false">取消</el-button>
          <el-button type="primary" :loading="embeddingSubmitting" @click="handleSaveEmbedding">保存</el-button>
        </template>
      </el-dialog>

      <!-- Permission Dialog -->
      <PermissionDialog v-model:visible="permissionDialogVisible" :kb-id="kbId" />
    </template>

    <el-empty v-else description="知识库不存在" />
  </div>
</template>

<style scoped>
/* 操作列按钮间距由容器 gap 控制，覆盖 Element Plus 相邻按钮默认 12px 间距 */
:deep(.operation-cell .el-button + .el-button) {
  margin-left: 0;
}
</style>
