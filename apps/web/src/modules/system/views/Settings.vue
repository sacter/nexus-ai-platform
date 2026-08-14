<script setup lang="ts">
import { reactive, ref, onMounted } from 'vue'
import { Setting } from '@element-plus/icons-vue'
import { settingsApi } from '@/modules/system/api/settings.api'
const form = reactive({ siteName: '', defaultModel: '' })
const loading = ref(false)
const saved = ref(false)
onMounted(async () => { try { const data = await settingsApi.get(); Object.assign(form, data) } catch { /* 忽略读取失败 */ } })
async function handleSave() { loading.value = true; try { await settingsApi.update(form); saved.value = true } finally { loading.value = false } }
</script>
<template>
  <div>
    <div class="mb-6 flex items-center gap-3">
      <div
        class="flex h-10 w-10 items-center justify-center rounded-xl shrink-0"
        style="background: var(--brand-gradient); box-shadow: 0 8px 20px -8px color-mix(in oklch, var(--accent) 55%, transparent)"
      >
        <el-icon
          :size="18"
          color="#fff"
        >
          <Setting />
        </el-icon>
      </div>
      <div>
        <h1
          class="font-display text-2xl font-bold tracking-tight"
          style="color: var(--foreground)"
        >
          设置
        </h1>
        <p
          class="mt-0.5 text-xs"
          style="color: var(--foreground); opacity: 0.55"
        >
          配置平台站点信息与默认模型
        </p>
      </div>
    </div>
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
