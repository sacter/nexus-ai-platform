<script setup lang="ts">
import { ref, watch, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Upload, Search, List, FolderOpened, MoreFilled, Document } from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { useKnowledgeBase, useDeleteKnowledgeBase } from '@/modules/knowledge/composables/useKnowledge'
import { useDocuments, useDeleteDocument } from '@/modules/knowledge/composables/useDocuments'
import { useMyPermission } from '@/modules/knowledge/composables/usePermissions'
import { useBreadcrumbStore } from '@/stores/breadcrumb'
import DocumentUpload from '@/modules/knowledge/components/DocumentUpload.vue'
import KnowledgeCreateDialog from '@/modules/knowledge/components/KnowledgeCreateDialog.vue'
import PermissionDialog from '@/modules/knowledge/components/PermissionDialog.vue'
import type { KnowledgeBase } from '@/modules/knowledge/types/knowledge'
import type { Document as DocType } from '@/modules/knowledge/types/document'
import type { KbPermission } from '@/modules/knowledge/types/permission'
import { formatDate } from '@/utils/format'

const route = useRoute()
const router = useRouter()
const kbId = route.params.kbId as string
const { data: kb, isLoading: kbLoading } = useKnowledgeBase(kbId)
const { data: docs, isLoading: docsLoading } = useDocuments(kbId)
const deleteKbMutation = useDeleteKnowledgeBase()
const deleteDocMutation = useDeleteDocument()
const breadcrumb = useBreadcrumbStore()

const uploadDialogVisible = ref(false)
const editDialogVisible = ref(false)
const permissionDialogVisible = ref(false)
const activeTab = ref('documents')
const viewMode = ref<'list' | 'tree'>('list')
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

function handleDeleteDoc(id: string) {
  deleteDocMutation.mutate({ kbId, id })
}

function getStatusType(status: DocType['status']) {
  const map: Record<string, string> = {
    READY: 'success',
    PROCESSING: 'warning',
    UPLOADING: 'info',
    DELETED: 'danger',
  }
  return map[status] || 'info'
}

function getStatusLabel(status: DocType['status']) {
  const map: Record<string, string> = {
    READY: '已就绪',
    PROCESSING: '处理中',
    UPLOADING: '上传中',
    DELETED: '已删除',
  }
  return map[status] || status
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
                  <div class="flex items-center border rounded-lg overflow-hidden" style="border-color: var(--el-border-color)">
                    <el-button
                      size="small"
                      :type="viewMode === 'list' ? 'primary' : ''"
                      :icon="List"
                      @click="viewMode = 'list'"
                      style="border-radius: 0"
                    />
                    <el-button
                      size="small"
                      :type="viewMode === 'tree' ? 'primary' : ''"
                      :icon="FolderOpened"
                      @click="viewMode = 'tree'"
                      style="border-radius: 0"
                    />
                  </div>
                  <el-input
                    v-model="searchQuery"
                    placeholder="搜索文档名称"
                    :prefix-icon="Search"
                    style="width: 220px"
                    size="small"
                  />
                </div>
              </div>

              <el-table
                :data="(docs as DocType[]) || []"
                v-loading="docsLoading"
                stripe
                empty-text="请先导入文档"
              >
                <el-table-column label="文档名称 / ID" min-width="200">
                  <template #default="{ row }">
                    <div>
                      <div class="font-medium" style="color: var(--foreground)">{{ row.name }}</div>
                      <div class="text-xs" style="color: var(--foreground); opacity: 0.4">{{ row.id }}</div>
                    </div>
                  </template>
                </el-table-column>
                <el-table-column label="文档状态" width="120">
                  <template #default="{ row }">
                    <el-tag :type="getStatusType(row.status)" size="small">
                      {{ getStatusLabel(row.status) }}
                    </el-tag>
                  </template>
                </el-table-column>
                <el-table-column label="切片数" width="100">
                  <template #default="{ row }">
                    {{ row.chunkCount }}
                  </template>
                </el-table-column>
                <el-table-column label="版本" width="80">
                  <template #default="{ row }">
                    v{{ row.version }}
                  </template>
                </el-table-column>
                <el-table-column label="上传时间" width="160">
                  <template #default="{ row }">
                    {{ row.createdAt }}
                  </template>
                </el-table-column>
                <el-table-column label="更新时间" width="160">
                  <template #default="{ row }">
                    {{ row.updatedAt }}
                  </template>
                </el-table-column>
                <el-table-column label="操作" width="120" fixed="right">
                  <template #default="{ row }">
                    <el-button size="small" text type="danger" @click="handleDeleteDoc(row.id)">
                      删除
                    </el-button>
                  </template>
                </el-table-column>
              </el-table>
            </div>
          </el-tab-pane>

          <el-tab-pane label="切片详情" name="chunks">
            <div class="flex items-center justify-center py-20">
              <div class="text-center">
                <p class="text-sm" style="color: var(--foreground); opacity: 0.6">暂无切片数据</p>
              </div>
            </div>
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
      <el-dialog v-model="uploadDialogVisible" title="上传文档" width="500px">
        <DocumentUpload :kb-id="kbId" />
      </el-dialog>

      <!-- Edit Dialog -->
      <KnowledgeCreateDialog v-model:visible="editDialogVisible" :kb="(kb as KnowledgeBase)" />

      <!-- Permission Dialog -->
      <PermissionDialog v-model:visible="permissionDialogVisible" :kb-id="kbId" />
    </template>

    <el-empty v-else description="知识库不存在" />
  </div>
</template>
