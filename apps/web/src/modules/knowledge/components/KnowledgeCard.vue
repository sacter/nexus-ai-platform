<script setup lang="ts">
import { computed } from 'vue'
import { Document, View, Delete } from '@element-plus/icons-vue'
import { formatDate } from '@/utils/format'

const props = defineProps<{
  id: string
  name: string
  description?: string
  creatorName?: string
  createdAt?: string
  isActive?: boolean
  userRole?: string | null
}>()

const emit = defineEmits<{
  view: [id: string]
  delete: [id: string, isActive: boolean]
}>()

const gradients = [
  'linear-gradient(135deg, #5b7cfa 0%, #3f5bd9 100%)',
  'linear-gradient(135deg, #7c6cf0 0%, #5a3fd9 100%)',
  'linear-gradient(135deg, #2ec4b6 0%, #1a8f84 100%)',
  'linear-gradient(135deg, #ff9f43 0%, #ee5a24 100%)',
  'linear-gradient(135deg, #ff6b81 0%, #eb3b5a 100%)',
  'linear-gradient(135deg, #37474f 0%, #212a30 100%)',
  'linear-gradient(135deg, #54a0ff 0%, #2e86de 100%)',
  'linear-gradient(135deg, #9980fa 0%, #6c5ce7 100%)',
]

function hashString(str: string): number {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    hash = (Math.imul(31, hash) + str.charCodeAt(i)) | 0
  }
  return Math.abs(hash)
}

// 根据 id 固定选择渐变，保证同一知识库每次渲染颜色一致
const squareStyle = computed(() => ({
  background: gradients[hashString(props.id) % gradients.length],
}))

const createdText = computed(() =>
  props.createdAt ? formatDate(props.createdAt, 'yyyy-mm-dd') : '--',
)

const canDelete = computed(() => props.userRole === 'admin')
</script>

<template>
  <el-card
    shadow="hover"
    class="group cursor-pointer rounded-lg"
    @click="emit('view', id)"
  >
    <div class="flex items-center gap-4">
      <div class="flex-1 min-w-0">
        <div class="flex items-center gap-2 mb-1">
          <h3
            class="text-base font-semibold truncate"
            style="color: var(--foreground)"
          >
            {{ name }}
          </h3>
          <el-tag
            :type="isActive ? 'success' : 'info'"
            size="small"
          >
            {{ isActive ? '开启中' : '未开启' }}
          </el-tag>
        </div>
        <p
          class="text-sm truncate mb-2"
          :style="{ color: 'var(--foreground)', opacity: description ? 0.6 : 0.35 }"
        >
          {{ description || '暂无描述' }}
        </p>
        <div
          class="flex items-center gap-4 text-xs"
          style="color: var(--foreground); opacity: 0.55"
        >
          <span v-if="creatorName">创建人：{{ creatorName }}</span>
          <span>创建日期：{{ createdText }}</span>
        </div>
      </div>

      <!-- 右侧渐变方块图 -->
      <div
        class="w-12 h-12 shrink-0 rounded-lg flex items-center justify-center transition-transform duration-200 group-hover:scale-105"
        :style="squareStyle"
      >
        <el-icon
          :size="26"
          color="#fff"
        >
          <Document />
        </el-icon>
      </div>
    </div>

    <div class="flex justify-end mt-3">
      <el-button
        size="small"
        text
        type="primary"
        @click.stop="emit('view', id)"
      >
        <el-icon class="mr-1">
          <View />
        </el-icon>查看
      </el-button>
      <el-button
        v-if="canDelete"
        size="small"
        text
        type="danger"
        @click.stop="emit('delete', id, isActive ?? false)"
      >
        <el-icon class="mr-1">
          <Delete />
        </el-icon>删除
      </el-button>
    </div>
  </el-card>
</template>
