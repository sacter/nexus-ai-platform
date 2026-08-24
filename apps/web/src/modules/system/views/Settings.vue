<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { ElMessage, type FormInstance, type FormRules } from 'element-plus'
import {
  Check,
  Collection,
  Cpu,
  Document,
  FolderOpened,
  InfoFilled,
  MagicStick,
  Refresh,
  Search,
  Setting,
  Upload,
} from '@element-plus/icons-vue'
import { settingsApi } from '@/modules/system/api/settings.api'
import {
  DEFAULT_SETTINGS,
  SETTINGS_LIMITS,
  UPLOAD_TYPE_OPTIONS,
  hasSettingsChanged,
  mergeSettings,
  type Settings,
  type UploadTypeKey,
} from '@/modules/system/types/settings'

const formRef = ref<FormInstance>()
const loading = ref(false)
const saving = ref(false)
const loadError = ref(false)
const activeSection = ref('retrieval')
const savedAt = ref<string | null>(null)
const original = ref<Settings | null>(null)
const form = reactive<Settings>(mergeSettings())

const rules: FormRules = {
  'embedding.model': [{ required: true, message: '请输入嵌入模型名称', trigger: 'blur' }],
  'rerank.model': [{ required: true, message: '请输入重排序模型名称', trigger: 'blur' }],
  'chunk.size': [{ type: 'number', min: SETTINGS_LIMITS.chunkSize.min, max: SETTINGS_LIMITS.chunkSize.max, message: '分块大小需在 100–8000 之间', trigger: 'change' }],
  'chunk.overlap': [{ type: 'number', min: SETTINGS_LIMITS.chunkOverlap.min, max: SETTINGS_LIMITS.chunkOverlap.max, message: '重叠长度需在 0–2000 之间', trigger: 'change' }],
  'retrieval.topK': [{ type: 'number', min: SETTINGS_LIMITS.retrievalTopK.min, max: SETTINGS_LIMITS.retrievalTopK.max, message: '候选数量需在 1–100 之间', trigger: 'change' }],
  'retrieval.similarityThreshold': [{ type: 'number', min: SETTINGS_LIMITS.similarityThreshold.min, max: SETTINGS_LIMITS.similarityThreshold.max, message: '相似度阈值需在 0–1 之间', trigger: 'change' }],
}

const dirty = computed(() => hasSettingsChanged(form, original.value))
const activeSectionLabel = computed(() => sections.find((section) => section.key === activeSection.value)?.label ?? '设置')
const maxFileSizeMb = computed({
  get: () => Math.round(form.system.maxFileSize / 1024 / 1024),
  set: (value: number) => { form.system.maxFileSize = value * 1024 * 1024 },
})
const enabledUploadTypes = computed(() => new Set(form.system.allowedTypes))

const sections = [
  { key: 'retrieval', label: '检索策略', caption: '召回与相似度', icon: Search },
  { key: 'embedding', label: '向量模型', caption: 'Embedding 配置', icon: Cpu },
  { key: 'chunk', label: '文档分块', caption: '切分与上下文', icon: Collection },
  { key: 'rerank', label: '重排序', caption: '结果精排', icon: MagicStick },
  { key: 'queryRewrite', label: '查询改写', caption: '提升问题召回', icon: Refresh },
  { key: 'system', label: '文件接入', caption: '大小与格式', icon: FolderOpened },
] as const

function isUploadTypeEnabled(key: UploadTypeKey) {
  return UPLOAD_TYPE_OPTIONS.find((option) => option.key === key)?.mime.split(',').some((mime) => enabledUploadTypes.value.has(mime)) ?? false
}

function toggleUploadType(key: UploadTypeKey, enabled: boolean) {
  const option = UPLOAD_TYPE_OPTIONS.find((item) => item.key === key)
  if (!option) return
  const mimes = option.mime.split(',')
  if (enabled) {
    for (const mime of mimes) if (!form.system.allowedTypes.includes(mime)) form.system.allowedTypes.push(mime)
  } else {
    form.system.allowedTypes = form.system.allowedTypes.filter((mime) => !mimes.includes(mime))
  }
}

function restoreDefaults() {
  Object.assign(form, mergeSettings(DEFAULT_SETTINGS))
  ElMessage.info('已恢复推荐配置，点击保存后生效')
}

async function loadSettings() {
  loading.value = true
  loadError.value = false
  try {
    const response = await settingsApi.get()
    const next = mergeSettings(response)
    Object.assign(form, next)
    original.value = mergeSettings(next)
  } catch {
    loadError.value = true
    original.value = mergeSettings(form)
  } finally {
    loading.value = false
  }
}

async function saveSettings() {
  if (!formRef.value) return
  const valid = await formRef.value.validate().catch(() => false)
  if (!valid) return
  saving.value = true
  try {
    const response = await settingsApi.update(form)
    const next = mergeSettings(response ?? form)
    Object.assign(form, next)
    original.value = mergeSettings(next)
    savedAt.value = new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
    ElMessage.success('系统设置已保存')
  } catch (error) {
    ElMessage.error((error as Error).message || '保存失败，请稍后重试')
  } finally {
    saving.value = false
  }
}

onMounted(loadSettings)
</script>

<template>
  <main class="settings-page">
    <header class="settings-header">
      <div class="title-group">
        <div class="title-mark"><el-icon :size="19" color="#fff"><Setting /></el-icon></div>
        <div>
          <p class="eyebrow">SYSTEM / CONTROL PLANE</p>
          <h1>系统设置</h1>
          <p class="subtitle">调整知识库的处理与检索行为，配置将作用于后续任务。</p>
        </div>
      </div>
      <div class="header-status" :class="{ 'is-dirty': dirty }" data-test="save-status">
        <span class="status-dot" />
        {{ dirty ? '有未保存更改' : savedAt ? `已保存 ${savedAt}` : '配置已同步' }}
      </div>
    </header>

    <el-alert v-if="loadError" class="load-alert" type="warning" show-icon :closable="false" title="未能读取服务器配置，当前显示本地默认值。">
      <el-button size="small" type="warning" plain @click="loadSettings">重新读取</el-button>
    </el-alert>

    <div class="settings-layout" :class="{ 'is-loading': loading }">
      <nav class="section-nav" aria-label="设置分组">
        <div class="nav-intro"><span class="nav-kicker">配置目录</span><span class="nav-count">{{ sections.length }} 个模块</span></div>
        <button
          v-for="section in sections"
          :key="section.key"
          type="button"
          class="section-link"
          :class="{ active: activeSection === section.key }"
          @click="activeSection = section.key"
        >
          <span class="section-icon"><el-icon><component :is="section.icon" /></el-icon></span>
          <span class="section-copy"><strong>{{ section.label }}</strong><small>{{ section.caption }}</small></span>
          <span class="section-arrow">›</span>
        </button>
        <div class="nav-note"><el-icon><InfoFilled /></el-icon><span>所有数值会在服务端校验后生效。</span></div>
      </nav>

      <section class="settings-content">
        <div class="content-heading">
          <div><span class="content-kicker">当前模块</span><h2>{{ activeSectionLabel }}</h2></div>
          <el-button link :icon="Refresh" :disabled="loading" @click="loadSettings">刷新配置</el-button>
        </div>

        <el-form ref="formRef" :model="form" :rules="rules" label-position="top" class="settings-form">
          <section v-show="activeSection === 'retrieval'" class="config-section">
            <div class="section-heading"><div class="heading-symbol blue"><el-icon><Search /></el-icon></div><div><h3>检索策略</h3><p>决定系统如何从知识库中召回相关内容。</p></div></div>
            <div class="field-grid two-columns">
              <el-form-item label="检索方式" prop="retrieval.strategy"><el-radio-group v-model="form.retrieval.strategy" class="strategy-options"><el-radio-button value="vector">向量检索</el-radio-button><el-radio-button value="hybrid">混合检索</el-radio-button></el-radio-group></el-form-item>
              <el-form-item label="召回数量" prop="retrieval.topK"><el-input-number v-model="form.retrieval.topK" :min="SETTINGS_LIMITS.retrievalTopK.min" :max="SETTINGS_LIMITS.retrievalTopK.max" controls-position="right" /></el-form-item>
              <el-form-item label="相似度阈值" prop="retrieval.similarityThreshold"><el-slider v-model="form.retrieval.similarityThreshold" :min="0" :max="1" :step="0.05" show-input /></el-form-item>
            </div>
            <div class="tip-row"><el-icon><InfoFilled /></el-icon><span>混合检索会结合向量相似度与关键词匹配，适合包含专有名词的企业知识库。</span></div>
          </section>

          <section v-show="activeSection === 'embedding'" class="config-section">
            <div class="section-heading"><div class="heading-symbol violet"><el-icon><Cpu /></el-icon></div><div><h3>向量模型</h3><p>用于将文档与查询转换为可检索的向量。</p></div></div>
            <div class="field-grid two-columns"><el-form-item label="Provider" prop="embedding.provider"><el-input v-model="form.embedding.provider" placeholder="例如 openai / ollama" /></el-form-item><el-form-item label="模型名称" prop="embedding.model"><el-input v-model="form.embedding.model" placeholder="text-embedding-3-small" /></el-form-item><el-form-item label="向量维度" prop="embedding.dimension"><el-input-number v-model="form.embedding.dimension" :min="1" :max="32768" controls-position="right" /></el-form-item></div>
            <div class="model-callout"><span class="callout-line" /><div><strong>当前向量空间</strong><p>{{ form.embedding.model }} · {{ form.embedding.dimension }} dimensions</p></div><el-tag type="success" effect="plain">已配置</el-tag></div>
          </section>

          <section v-show="activeSection === 'chunk'" class="config-section">
            <div class="section-heading"><div class="heading-symbol amber"><el-icon><Collection /></el-icon></div><div><h3>文档分块</h3><p>控制进入向量化流程前的文本切分粒度。</p></div></div>
            <div class="field-grid two-columns"><el-form-item label="分块大小" prop="chunk.size"><el-input-number v-model="form.chunk.size" :min="SETTINGS_LIMITS.chunkSize.min" :max="SETTINGS_LIMITS.chunkSize.max" controls-position="right" /><span class="unit-label">字符</span></el-form-item><el-form-item label="重叠长度" prop="chunk.overlap"><el-input-number v-model="form.chunk.overlap" :min="SETTINGS_LIMITS.chunkOverlap.min" :max="SETTINGS_LIMITS.chunkOverlap.max" controls-position="right" /><span class="unit-label">字符</span></el-form-item></div>
            <div class="chunk-preview"><div class="preview-label">CHUNK PREVIEW</div><div class="preview-track"><span class="chunk-block first">{{ form.chunk.size }} chars</span><span class="overlap-block">{{ form.chunk.overlap }} overlap</span><span class="chunk-block second">next chunk</span></div><p>重叠内容帮助模型理解跨段落的上下文。</p></div>
          </section>

          <section v-show="activeSection === 'rerank'" class="config-section">
            <div class="section-heading"><div class="heading-symbol green"><el-icon><MagicStick /></el-icon></div><div><h3>重排序</h3><p>对初步召回的结果再次精排，提升答案相关性。</p></div></div>
            <div class="toggle-row"><div><strong>启用 Rerank</strong><p>使用专用模型对候选结果进行二次排序。</p></div><el-switch v-model="form.rerank.enabled" /></div>
            <div class="field-grid two-columns" :class="{ muted: !form.rerank.enabled }"><el-form-item label="重排序模型" prop="rerank.model"><el-input v-model="form.rerank.model" :disabled="!form.rerank.enabled" placeholder="bge-reranker-v2-m3" /></el-form-item><el-form-item label="候选结果数" prop="rerank.topN"><el-input-number v-model="form.rerank.topN" :disabled="!form.rerank.enabled" :min="1" :max="100" controls-position="right" /></el-form-item><el-form-item label="最终保留数" prop="rerank.rerankTopK"><el-input-number v-model="form.rerank.rerankTopK" :disabled="!form.rerank.enabled" :min="1" :max="50" controls-position="right" /></el-form-item></div>
          </section>

          <section v-show="activeSection === 'queryRewrite'" class="config-section">
            <div class="section-heading"><div class="heading-symbol pink"><el-icon><MagicStick /></el-icon></div><div><h3>查询改写</h3><p>在检索前生成多个查询变体，覆盖更多表达方式。</p></div></div>
            <div class="toggle-row"><div><strong>启用查询改写</strong><p>适合用户问题较短或上下文不完整的场景。</p></div><el-switch v-model="form.queryRewrite.enabled" /></div>
            <el-form-item label="改写问题数量" prop="queryRewrite.count" class="narrow-field"><el-input-number v-model="form.queryRewrite.count" :disabled="!form.queryRewrite.enabled" :min="1" :max="10" controls-position="right" /><span class="unit-label">个</span></el-form-item>
          </section>

          <section v-show="activeSection === 'system'" class="config-section">
            <div class="section-heading"><div class="heading-symbol slate"><el-icon><FolderOpened /></el-icon></div><div><h3>文件接入</h3><p>限制上传文件体积，并明确知识库可处理的格式。</p></div></div>
            <el-form-item label="单文件大小上限" prop="system.maxFileSize" class="narrow-field"><el-input-number v-model="maxFileSizeMb" :min="SETTINGS_LIMITS.maxFileSizeMB.min" :max="SETTINGS_LIMITS.maxFileSizeMB.max" controls-position="right" /><span class="unit-label">MB</span></el-form-item>
            <div class="upload-types"><div class="field-label">允许的文件类型</div><div class="type-grid"><label v-for="option in UPLOAD_TYPE_OPTIONS" :key="option.key" class="type-option" :class="{ enabled: isUploadTypeEnabled(option.key) }"><el-checkbox :model-value="isUploadTypeEnabled(option.key)" @update:model-value="(value: unknown) => toggleUploadType(option.key, Boolean(value))" /><span class="file-icon"><el-icon><Document /></el-icon></span><span class="type-copy"><strong>{{ option.label }}</strong><small>{{ option.description }}</small></span><el-icon v-if="isUploadTypeEnabled(option.key)" class="type-check"><Check /></el-icon></label></div></div>
          </section>
        </el-form>
      </section>
    </div>

    <footer class="save-bar"><div class="save-context"><el-icon><Upload /></el-icon><span>{{ dirty ? '配置已修改，保存后对新任务生效' : '当前没有待保存的修改' }}</span></div><div class="save-actions"><el-button data-test="restore-defaults" :disabled="saving || loading" @click="restoreDefaults">恢复默认</el-button><el-button data-test="save-settings" type="primary" :loading="saving" :disabled="!dirty" @click="saveSettings">保存设置</el-button></div></footer>
  </main>
</template>

<style scoped>
.settings-page { color:var(--foreground); padding-bottom:78px; animation:rise-in .35s ease-out both; }
.settings-header { display:flex; justify-content:space-between; align-items:flex-start; gap:20px; margin-bottom:28px; }.title-group { display:flex; gap:14px; align-items:center; }.title-mark { display:flex; align-items:center; justify-content:center; width:42px; height:42px; flex-shrink:0; border-radius:12px; background:var(--brand-gradient); box-shadow:0 8px 20px -8px color-mix(in oklch,var(--accent) 55%,transparent); }.eyebrow,.content-kicker,.nav-kicker,.preview-label { margin:0 0 4px; font:600 .62rem/1.2 var(--font-mono,monospace); letter-spacing:.08em; text-transform:uppercase; opacity:.48; }.settings-header h1 { margin:0; font-family:var(--font-display,inherit); font-size:1.55rem; letter-spacing:-.025em; }.subtitle { margin:3px 0 0; font-size:.76rem; opacity:.56; }.header-status { display:flex; align-items:center; gap:7px; padding:7px 10px; border:1px solid var(--border); border-radius:99px; font-size:.72rem; opacity:.65; white-space:nowrap; }.header-status.is-dirty { color:var(--el-color-warning); border-color:color-mix(in oklch,var(--el-color-warning) 40%,var(--border)); opacity:1; }.status-dot { width:6px; height:6px; border-radius:50%; background:var(--el-color-success); }.is-dirty .status-dot { background:var(--el-color-warning); }
.load-alert { margin-bottom:16px; }.settings-layout { display:grid; grid-template-columns:238px minmax(0,1fr); gap:22px; align-items:start; }.section-nav { position:sticky; top:20px; padding:10px; border:1px solid var(--border); border-radius:14px; background:var(--surface); }.nav-intro { display:flex; justify-content:space-between; align-items:center; padding:5px 8px 12px; }.nav-count { font-size:.65rem; opacity:.42; }.section-link { display:flex; align-items:center; width:100%; gap:9px; padding:9px 8px; border:0; border-radius:9px; color:var(--foreground); background:transparent; text-align:left; cursor:pointer; transition:background .18s,color .18s; }.section-link:hover { background:var(--surface-secondary); }.section-link.active { color:var(--accent); background:color-mix(in oklch,var(--accent) 10%,var(--surface)); }.section-icon { display:flex; align-items:center; justify-content:center; width:28px; height:28px; border-radius:7px; background:var(--surface-secondary); }.active .section-icon { background:color-mix(in oklch,var(--accent) 15%,var(--surface)); }.section-copy { display:flex; flex:1; flex-direction:column; gap:2px; }.section-copy strong { font-size:.77rem; font-weight:600; }.section-copy small { font-size:.63rem; opacity:.5; }.section-arrow { font-size:1rem; opacity:.35; }.nav-note { display:flex; gap:6px; margin:15px 5px 3px; padding-top:12px; border-top:1px solid var(--border); font-size:.64rem; line-height:1.45; opacity:.48; }.nav-note .el-icon { flex-shrink:0; margin-top:1px; }
.settings-content { min-width:0; }.content-heading { display:flex; align-items:flex-end; justify-content:space-between; padding:4px 2px 15px; border-bottom:1px solid var(--border); }.content-heading h2 { margin:0; font-size:1.1rem; font-weight:650; }.settings-form { padding-top:20px; }.config-section { min-height:400px; }.section-heading { display:flex; align-items:flex-start; gap:11px; margin-bottom:25px; }.heading-symbol { display:flex; align-items:center; justify-content:center; width:34px; height:34px; flex-shrink:0; border-radius:9px; }.heading-symbol.blue { color:#4f8cff; background:color-mix(in oklch,#4f8cff 13%,transparent); }.heading-symbol.violet { color:#9b7bff; background:color-mix(in oklch,#9b7bff 13%,transparent); }.heading-symbol.amber { color:#d99535; background:color-mix(in oklch,#d99535 13%,transparent); }.heading-symbol.green { color:#38b989; background:color-mix(in oklch,#38b989 13%,transparent); }.heading-symbol.pink { color:#e26c9c; background:color-mix(in oklch,#e26c9c 13%,transparent); }.heading-symbol.slate { color:#7888a6; background:color-mix(in oklch,#7888a6 13%,transparent); }.section-heading h3 { margin:0 0 3px; font-size:.95rem; }.section-heading p { margin:0; font-size:.73rem; opacity:.52; }.field-grid { display:grid; gap:2px 22px; }.two-columns { grid-template-columns:repeat(2,minmax(0,1fr)); }.settings-form :deep(.el-form-item__label),.field-label { color:var(--foreground); font-size:.72rem; font-weight:600; }.settings-form :deep(.el-input-number),.settings-form :deep(.el-input),.settings-form :deep(.el-select) { width:100%; }.strategy-options { width:100%; display:flex; }.strategy-options :deep(.el-radio-button) { flex:1; }.strategy-options :deep(.el-radio-button__inner) { width:100%; }.unit-label { margin-left:8px; font-size:.72rem; opacity:.5; }.tip-row { display:flex; gap:7px; align-items:flex-start; margin-top:12px; padding:11px 13px; border-left:2px solid var(--accent); background:color-mix(in oklch,var(--accent) 6%,transparent); font-size:.7rem; line-height:1.5; opacity:.72; }.model-callout { display:flex; align-items:center; gap:10px; margin-top:8px; padding:13px; border:1px solid var(--border); border-radius:9px; }.callout-line { width:3px; height:29px; border-radius:2px; background:var(--el-color-success); }.model-callout div { flex:1; }.model-callout strong { font-size:.72rem; }.model-callout p { margin:3px 0 0; font: .67rem var(--font-mono,monospace); opacity:.52; }.toggle-row { display:flex; align-items:center; justify-content:space-between; gap:16px; margin:0 0 23px; padding:15px 16px; border:1px solid var(--border); border-radius:10px; background:var(--surface-secondary); }.toggle-row strong { display:block; font-size:.78rem; }.toggle-row p { margin:4px 0 0; font-size:.7rem; opacity:.5; }.field-grid.muted { opacity:.6; }.narrow-field { max-width:350px; }.chunk-preview { margin-top:14px; padding:15px; border:1px solid var(--border); border-radius:10px; background:var(--surface-secondary); }.preview-track { display:flex; align-items:center; height:34px; margin:10px 0 7px; overflow:hidden; border-radius:5px; font: .63rem var(--font-mono,monospace); }.chunk-block { display:flex; align-items:center; height:100%; padding:0 12px; background:color-mix(in oklch,var(--accent) 24%,transparent); }.chunk-block.first { flex:3; }.chunk-block.second { flex:2; opacity:.55; }.overlap-block { display:flex; align-items:center; height:100%; padding:0 7px; color:var(--el-color-warning); background:color-mix(in oklch,var(--el-color-warning) 18%,transparent); }.chunk-preview p { margin:0; font-size:.67rem; opacity:.5; }.upload-types { margin-top:11px; }.type-grid { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:9px; margin-top:8px; }.type-option { display:flex; align-items:center; gap:7px; padding:11px; border:1px solid var(--border); border-radius:9px; cursor:pointer; transition:border-color .18s,background .18s; }.type-option:hover,.type-option.enabled { border-color:color-mix(in oklch,var(--accent) 48%,var(--border)); background:color-mix(in oklch,var(--accent) 5%,transparent); }.type-option :deep(.el-checkbox) { margin-right:0; }.file-icon { display:flex; align-items:center; justify-content:center; width:25px; height:25px; border-radius:6px; background:var(--surface-secondary); color:var(--accent); }.type-copy { display:flex; flex:1; flex-direction:column; gap:2px; }.type-copy strong { font-size:.7rem; }.type-copy small { font-size:.61rem; opacity:.5; }.type-check { color:var(--el-color-success); }
.save-bar { position:fixed; z-index:10; right:0; bottom:0; left:0; display:flex; align-items:center; justify-content:space-between; gap:16px; padding:11px max(24px,calc((100vw - 1200px)/2)); border-top:1px solid var(--border); background:color-mix(in oklch,var(--surface) 92%,transparent); box-shadow:0 -8px 25px -20px var(--foreground); backdrop-filter:blur(12px); }.save-context { display:flex; align-items:center; gap:7px; font-size:.7rem; opacity:.55; }.save-actions { display:flex; gap:8px; }
@media (max-width:800px) { .settings-layout { grid-template-columns:1fr; }.section-nav { position:static; display:flex; gap:5px; overflow-x:auto; padding:7px; }.nav-intro,.nav-note,.section-arrow { display:none; }.section-link { flex:0 0 auto; width:auto; padding:7px; }.section-copy small { display:none; }.section-copy { flex:none; }.section-icon { width:30px; height:30px; }.settings-header { margin-bottom:18px; }.header-status { align-self:center; }.two-columns,.type-grid { grid-template-columns:1fr; } }
@media (max-width:560px) { .settings-header { align-items:flex-start; }.settings-header h1 { font-size:1.3rem; }.subtitle { max-width:230px; line-height:1.45; }.header-status { padding:5px; font-size:0; }.header-status .status-dot { width:7px; height:7px; }.save-bar { padding:10px 14px; }.save-context span { display:none; }.save-actions { flex:1; }.save-actions .el-button { flex:1; }.config-section { min-height:460px; } }
@media (prefers-reduced-motion:reduce) { .settings-page,.section-link,.type-option { animation:none; transition:none; } }
</style>
