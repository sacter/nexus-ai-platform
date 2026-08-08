<script setup lang="ts">
import { reactive, ref, onMounted } from 'vue'
import { settingsApi } from '@/modules/system/api/settings.api'
const form = reactive({ siteName: '', defaultModel: '' })
const loading = ref(false)
const saved = ref(false)
onMounted(async () => { try { const data = await settingsApi.get(); Object.assign(form, data) } catch { /* 忽略读取失败 */ } })
async function handleSave() { loading.value = true; try { await settingsApi.update(form); saved.value = true } finally { loading.value = false } }
</script>
<template>
  <div>
    <h1
      class="text-2xl font-semibold mb-6"
      style="color: var(--foreground)"
    >
      设置
    </h1>
    <el-card>
      <el-form label-width="120px">
        <el-form-item label="站点名称">
          <el-input v-model="form.siteName" />
        </el-form-item>
        <el-form-item label="默认模型">
          <el-input v-model="form.defaultModel" />
        </el-form-item>
        <el-form-item>
          <el-button
            type="primary"
            :loading="loading"
            @click="handleSave"
          >
            保存
          </el-button><span
            v-if="saved"
            class="ml-2 text-sm"
            style="color: var(--el-color-success)"
          >已保存</span>
        </el-form-item>
      </el-form>
    </el-card>
  </div>
</template>
