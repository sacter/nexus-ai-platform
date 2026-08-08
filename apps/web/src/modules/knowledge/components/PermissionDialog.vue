<script setup lang="ts">
import { computed, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  useKbPermissions,
  useBatchAssignPermissions,
  useUpdatePermission,
  useRemovePermission,
  useAllUsers,
} from '@/modules/knowledge/composables/usePermissions'
import { useAuthStore } from '@/stores/auth'
import type { KbPermission, KbRole } from '@/modules/knowledge/types/permission'
import type { UserInfo } from '@/modules/system/auth/api/auth.api'

/* ---------- v-model & props ---------- */
const visible = defineModel<boolean>('visible', { default: false })
const props = defineProps<{ kbId: string }>()

/* ---------- stores & queries ---------- */
const auth = useAuthStore()
const currentUserId = computed(() => auth.user?.id ?? '')

const { data: permissions, isLoading: permsLoading } = useKbPermissions(
  computed(() => props.kbId),
)
const { data: allUsers, isLoading: usersLoading } = useAllUsers()

const batchAssignMutation = useBatchAssignPermissions()
const updatePermMutation = useUpdatePermission()
const removePermMutation = useRemovePermission()

const batchAssignLoading = computed(() => batchAssignMutation.isPending.value)
// const updatePermLoading = computed(() => updatePermMutation.isPending.value)
// const removePermLoading = computed(() => removePermMutation.isPending.value)

/* ---------- local state ---------- */
const searchKeyword = ref('')
const selectedRole = ref<KbRole | ''>('')
const selectedUserIds = ref<string[]>([])

/* ---------- computed ---------- */
const permissionsData = computed<KbPermission[]>(() => (permissions.value as KbPermission[]) ?? [])

const permittedUserIds = computed(() => new Set(permissionsData.value.map((p) => p.userId)))

const availableUsers = computed(() => {
  const users = (allUsers.value as UserInfo[]) ?? []
  return users.filter((u) => !permittedUserIds.value.has(u.id))
})

const filteredAvailableUsers = computed(() => {
  const kw = searchKeyword.value.toLowerCase().trim()
  if (!kw) return availableUsers.value
  return availableUsers.value.filter(
    (u) => u.username.toLowerCase().includes(kw) || u.email.toLowerCase().includes(kw),
  )
})

const filteredPermissions = computed(() => {
  const kw = searchKeyword.value.toLowerCase().trim()
  if (!kw) return permissionsData.value
  return permissionsData.value.filter((p) => {
    const name = p.user?.username ?? ''
    const email = p.user?.email ?? ''
    return name.toLowerCase().includes(kw) || email.toLowerCase().includes(kw)
  })
})

const batchDisabled = computed(() => selectedUserIds.value.length === 0 || !selectedRole.value)

/* ---------- role helpers ---------- */
const roleLabel: Record<KbRole, string> = {
  admin: '管理',
  editor: '上传&编辑',
  viewer: '只读',
}
const roleTagType: Record<KbRole, string> = {
  admin: 'danger',
  editor: 'warning',
  viewer: 'info',
}

function isCurrentUser(perm: KbPermission) {
  return perm.userId === currentUserId.value
}

/* ---------- handlers ---------- */
function onSelectionChange(rows: UserInfo[]) {
  selectedUserIds.value = rows.map((r) => r.id)
}

async function handleBatchAdd() {
  if (!selectedRole.value) return
  try {
    await batchAssignMutation.mutateAsync({
      kbId: props.kbId,
      permissions: selectedUserIds.value.map((uid) => ({
        userId: uid,
        role: selectedRole.value as KbRole,
      })),
    })
    selectedUserIds.value = []
    selectedRole.value = ''
    ElMessage.success('批量添加成功')
  } catch {
    // error handled by interceptor
  }
}

async function handleRoleChange(permissionId: string, role: KbRole) {
  try {
    await updatePermMutation.mutateAsync({ kbId: props.kbId, permissionId, role })
    ElMessage.success('角色已更新')
  } catch {
    // error handled by interceptor
  }
}

async function handleRemove(perm: KbPermission) {
  try {
    await ElMessageBox.confirm(`确定移除用户「${perm.user?.username}」的权限吗？`, '提示', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning',
    })
  } catch {
    return // 用户取消
  }
  try {
    await removePermMutation.mutateAsync({ kbId: props.kbId, permissionId: perm.id })
    ElMessage.success('已移除权限')
  } catch {
    // error handled by interceptor
  }
}
</script>

<template>
  <el-dialog
    v-model="visible"
    title="权限管理"
    width="720px"
  >
    <!-- 搜索与批量操作 -->
    <div class="flex items-center gap-3 mb-4">
      <el-input
        v-model="searchKeyword"
        placeholder="搜索用户名称或邮箱"
        clearable
        style="width: 220px"
      />
      <el-select
        v-model="selectedRole"
        placeholder="选择角色"
        style="width: 180px"
        clearable
      >
        <el-option
          label="管理"
          value="admin"
        />
        <el-option
          label="上传&编辑"
          value="editor"
        />
        <el-option
          label="只读"
          value="viewer"
        />
      </el-select>
      <el-button
        type="primary"
        :disabled="batchDisabled"
        :loading="batchAssignLoading"
        @click="handleBatchAdd"
      >
        批量添加
      </el-button>
    </div>

    <!-- 已授权用户 -->
    <h4
      class="text-sm font-semibold mb-2"
      style="color: var(--foreground)"
    >
      已授权用户
    </h4>
    <el-table
      v-loading="permsLoading"
      :data="filteredPermissions"
      stripe
      empty-text="暂无授权用户"
      class="mb-6"
      max-height="240"
    >
      <el-table-column
        label="用户名"
        min-width="120"
      >
        <template #default="{ row }">
          <span>{{ row.user?.username ?? row.userId }}</span>
          <el-tag
            v-if="isCurrentUser(row)"
            size="small"
            type="primary"
            class="ml-1"
          >
            我
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column
        label="邮箱"
        min-width="160"
      >
        <template #default="{ row }">
          {{ row.user?.email ?? '--' }}
        </template>
      </el-table-column>
      <el-table-column
        label="角色"
        width="140"
      >
        <template #default="{ row }">
          <el-tag
            :type="roleTagType[row.role as KbRole]"
            size="small"
          >
            {{ roleLabel[row.role as KbRole] }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column
        label="操作"
        width="180"
      >
        <template #default="{ row }">
          <el-select
            :model-value="row.role"
            size="small"
            style="width: 110px"
            @change="(val: KbRole) => handleRoleChange(row.id, val)"
          >
            <el-option
              label="管理"
              value="admin"
            />
            <el-option
              label="上传&编辑"
              value="editor"
            />
            <el-option
              label="只读"
              value="viewer"
            />
          </el-select>
          <el-button
            size="small"
            type="danger"
            text
            :disabled="isCurrentUser(row)"
            @click="handleRemove(row)"
          >
            移除
          </el-button>
        </template>
      </el-table-column>
    </el-table>

    <!-- 添加用户 -->
    <h4
      class="text-sm font-semibold mb-2"
      style="color: var(--foreground)"
    >
      添加用户
    </h4>
    <el-table
      v-loading="usersLoading"
      :data="filteredAvailableUsers"
      stripe
      empty-text="没有可添加的用户"
      max-height="240"
      @selection-change="onSelectionChange"
    >
      <el-table-column
        type="selection"
        width="50"
      />
      <el-table-column
        label="用户名"
        min-width="120"
      >
        <template #default="{ row }">
          {{ row.username }}
        </template>
      </el-table-column>
      <el-table-column
        label="邮箱"
        min-width="160"
      >
        <template #default="{ row }">
          {{ row.email }}
        </template>
      </el-table-column>
    </el-table>
  </el-dialog>
</template>
