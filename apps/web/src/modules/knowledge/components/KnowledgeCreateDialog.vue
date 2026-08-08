<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import type { FormInstance, FormRules } from 'element-plus'
import { useCreateKnowledgeBase, useUpdateKnowledgeBase } from '@/modules/knowledge/composables/useKnowledge'
import { EMBEDDING_MODEL_OPTIONS, type KnowledgeBase } from '@/modules/knowledge/types/knowledge'

const visible = defineModel<boolean>('visible', { default: false })
const props = defineProps<{ kb?: KnowledgeBase | null }>()

const isEdit = computed(() => !!props.kb)

const formRef = ref<FormInstance>()

const form = reactive({
  name: '',
  description: '',
  embeddingModel: 'bge-m3',
  retrievalStrategy: 'vector',
  isActive: true,
})

const rules: FormRules = {
  name: [{ required: true, message: '请输入知识库名称', trigger: 'blur' }],
  embeddingModel: [{ required: true, message: '请选择 Embedding 模型', trigger: 'change' }],
  retrievalStrategy: [{ required: true, message: '请选择检索方式', trigger: 'change' }],
}

const createMutation = useCreateKnowledgeBase()
const updateMutation = useUpdateKnowledgeBase()
const submitting = ref(false)

// 弹窗打开时：编辑模式预填数据，创建模式重置为默认值，并清除上次的校验错误
watch(visible, (val) => {
  if (!val) return
  if (props.kb) {
    form.name = props.kb.name
    form.description = props.kb.description ?? ''
    form.embeddingModel = props.kb.embeddingModel
    form.retrievalStrategy = props.kb.retrievalStrategy
    form.isActive = props.kb.isActive
  } else {
    form.name = ''
    form.description = ''
    form.embeddingModel = 'bge-m3'
    form.retrievalStrategy = 'vector'
    form.isActive = true
  }
  formRef.value?.clearValidate()
})

async function handleSubmit() {
  if (!formRef.value) return
  const valid = await formRef.value.validate().catch(() => false)
  if (!valid) return
  submitting.value = true
  try {
    if (props.kb) {
      await updateMutation.mutateAsync({ id: props.kb.id, data: { ...form } })
    } else {
      await createMutation.mutateAsync({ ...form })
    }
    visible.value = false
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <el-dialog
    v-model="visible"
    :title="isEdit ? '编辑知识库' : '创建知识库'"
    width="480px"
  >
    <el-form
      ref="formRef"
      :model="form"
      :rules="rules"
      @submit.prevent="handleSubmit"
    >
      <el-form-item
        label="名&nbsp;&nbsp;称"
        prop="name"
        required
      >
        <el-input
          v-model="form.name"
          placeholder="知识库名称"
        />
      </el-form-item>
      <el-form-item
        label="Embedding"
        prop="embeddingModel"
        required
      >
        <el-select
          v-model="form.embeddingModel"
          style="width: 100%"
        >
          <el-option
            v-for="opt in EMBEDDING_MODEL_OPTIONS"
            :key="opt.value"
            :label="opt.label"
            :value="opt.value"
          />
        </el-select>
      </el-form-item>
      <el-form-item
        label="检索方式"
        prop="retrievalStrategy"
        required
      >
        <el-radio-group v-model="form.retrievalStrategy">
          <el-radio value="vector">
            vector
          </el-radio>
          <el-radio value="hybrid">
            hybrid
          </el-radio>
        </el-radio-group>
      </el-form-item>
      <el-form-item
        v-if="isEdit"
        label="是否启用"
      >
        <el-switch v-model="form.isActive" />
      </el-form-item>
      <el-form-item label="描&nbsp;&nbsp;述">
        <el-input
          v-model="form.description"
          type="textarea"
          placeholder="知识库描述（可选）"
          :autosize="{ minRows: 4 }"
        />
      </el-form-item>
    </el-form>
    <template #footer>
      <el-button @click="visible = false">
        取消
      </el-button>
      <el-button
        type="primary"
        :loading="submitting"
        @click="handleSubmit"
      >
        {{ isEdit ? '保存' : '创建' }}
      </el-button>
    </template>
  </el-dialog>
</template>
