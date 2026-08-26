<script setup>
import { ref, reactive, watch, onMounted, onUnmounted } from 'vue'
import { api } from '../../api'

const SKEY = 'aigen_state'
const POLL_MS = 500
const ACTIVE_STATUS = ['queued', 'loading', 'running']

const tab = ref('t2i')
const tabs = [
  { key: 't2i', label: '文生图' },
  { key: 'i2i', label: '图生图' },
  { key: 'gallery', label: '图库' },
  { key: 'settings', label: '设置' },
]

const modelInfo = reactive({ models: [], loras: [], aux: {} })
const model = ref('')
const lora = ref('')

const form = reactive({
  prompt: '',
  negative_prompt: '',
  width: 512,
  height: 512,
  steps: 20,
  cfg: 7,
  seed: -1,
  count: 1,
  upscale: 'none',
})

const strength = ref(0.6)
const uploadUrl = ref('')
const previewUrl = ref('')

const jobId = ref('')
const job = ref(null)
const busy = ref(false)
const error = ref('')
const timer = ref(null)
const resW = ref(0)
const resH = ref(0)

const settings = reactive({
  model_dir: '',
  output_dir: '',
  easy_negative: true,
  fix_vae: true,
  upscale_default: 'none',
  default_steps: 20,
  default_cfg: 7,
  default_width: 512,
  default_height: 512,
})
const saveMsg = ref('')
const restoredSettings = ref(false)

const galleryItems = ref([])
const galleryTotal = ref(0)
const galleryLoading = ref(false)
const galleryError = ref('')
const galleryOffset = ref(0)
const GALLERY_PAGE = 60

const PRESETS = [
  { w: 512, h: 512, label: '512×512' },
  { w: 512, h: 768, label: '512×768' },
  { w: 768, h: 512, label: '768×512' },
  { w: 640, h: 640, label: '640×640' },
  { w: 640, h: 896, label: '640×896' },
]

function snapshot() {
  return {
    tab: tab.value,
    form: { ...form },
    model: model.value,
    lora: lora.value,
    strength: strength.value,
    settings: { ...settings },
    previewUrl: previewUrl.value,
    resW: resW.value,
    resH: resH.value,
    jobId: jobId.value,
    job: job.value ? { ...job.value } : null,
    busy: busy.value,
  }
}

function saveState() {
  try { sessionStorage.setItem(SKEY, JSON.stringify(snapshot())) } catch (e) { /* ignore */ }
}

function restoreState() {
  try {
    const s = JSON.parse(sessionStorage.getItem(SKEY) || 'null')
    if (!s) return
    if (s.tab) tab.value = s.tab
    if (s.form) Object.assign(form, s.form)
    if (s.model) model.value = s.model
    if (s.lora) lora.value = s.lora || ''
    if (s.strength) strength.value = s.strength
    if (s.settings) { Object.assign(settings, s.settings); restoredSettings.value = true }
    if (s.previewUrl) { previewUrl.value = s.previewUrl; uploadUrl.value = s.previewUrl }
    resW.value = s.resW || 0
    resH.value = s.resH || 0
    if (s.jobId) { jobId.value = s.jobId; job.value = s.job || { status: 'queued', progress: 0 } }
    busy.value = !!s.busy
  } catch (e) { /* ignore */ }
}

watch([tab, model, lora, strength, jobId, form, settings], saveState, { deep: true })
watch(tab, (t) => { if (t === 'gallery') loadGallery() })

async function loadGallery(reset = true) {
  if (reset) { galleryOffset.value = 0; galleryItems.value = [] }
  galleryLoading.value = true
  galleryError.value = ''
  try {
    const d = await api.agGallery({ limit: GALLERY_PAGE, offset: galleryOffset.value })
    galleryItems.value.push(...(d.items || []))
    galleryTotal.value = d.total || 0
    galleryOffset.value += (d.items || []).length
  } catch (e) {
    galleryError.value = e.message
  } finally {
    galleryLoading.value = false
  }
}

function loadMoreGallery() {
  if (!galleryLoading.value) loadGallery(false)
}

async function delGallery(it) {
  if (!window.confirm(`确定删除 ${it.name} ？`)) return
  try {
    await api.agGalleryDelete(it.name)
    await loadGallery()
  } catch (e) {
    galleryError.value = e.message
  }
}

const IMG_FMT = {
  t2i: { get: api.agGenerate },
  i2i: { get: api.agImg2img },
}

const statusText = () => {
  const s = job.value ? job.value.status : ''
  if (s === 'queued') return '排队中...'
  if (s === 'loading') return '正在加载模型（首次约 1-2 分钟）...'
  if (s === 'running') return `生成中... ${job.value.progress || 0}%`
  if (s === 'done') return '生成完成'
  if (s === 'error') return `失败: ${job.value.error || ''}`
  if (s === 'cancelled') return '已取消'
  return ''
}

async function loadModels() {
  try {
    const d = await api.agModels()
    Object.assign(modelInfo, d)
    if (!model.value && d.models && d.models.length) {
      model.value = d.models[0].name
    }
  } catch (e) {
    error.value = `获取模型列表失败: ${e.message}`
  }
}

async function loadConfig() {
  try {
    const c = await api.agConfig()
    if (restoredSettings.value) return
    Object.assign(settings, c)
    form.steps = c.default_steps || 20
    form.cfg = c.default_cfg || 7
    form.width = c.default_width || 512
    form.height = c.default_height || 512
    form.upscale = c.upscale_default || 'none'
  } catch (e) {
    /* ignore */
  }
}

function onFile(ev) {
  const f = ev.target.files && ev.target.files[0]
  if (!f) return
  const reader = new FileReader()
  reader.onload = () => {
    uploadUrl.value = String(reader.result)
    previewUrl.value = String(reader.result)
    const img = new Image()
    img.onload = () => {
      resW.value = img.width
      resH.value = img.height
      form.width = img.width
      form.height = img.height
    }
    img.src = String(reader.result)
  }
  reader.readAsDataURL(f)
  ev.target.value = ''
  saveState()
}

async function submit() {
  error.value = ''
  if (!form.prompt.trim()) { error.value = '请输入提示词'; return }
  if (tab.value === 'i2i' && !uploadUrl.value) { error.value = '请先上传输入图片'; return }
  busy.value = true
  job.value = null
  jobId.value = ''
  try {
    const params = {
      prompt: form.prompt,
      negative_prompt: form.negative_prompt || '',
      width: form.width,
      height: form.height,
      steps: parseInt(form.steps) || 20,
      cfg: parseFloat(form.cfg) || 7,
      seed: parseInt(form.seed) === -1 ? -1 : parseInt(form.seed),
      count: parseInt(form.count) || 1,
      lora: lora.value || '',
      model: model.value || '',
      upscale: form.upscale,
    }
    if (tab.value === 'i2i') {
      params.image = uploadUrl.value
      params.strength = parseFloat(strength.value) || 0.6
    }
    const d = await IMG_FMT[tab.value].get(params)
    jobId.value = d.job_id
    job.value = { status: 'queued', progress: 0 }
    saveState()
    poll()
  } catch (e) {
    error.value = e.message
    busy.value = false
    saveState()
  }
}

function poll() {
  if (timer.value) clearTimeout(timer.value)
  timer.value = setTimeout(async () => {
    try {
      const d = await api.agStatus(jobId.value)
      job.value = d
      if (!ACTIVE_STATUS.includes(d.status)) {
        busy.value = false
        saveState()
        return
      }
      poll()
    } catch (e) {
      job.value = { status: 'error', error: e.message }
      busy.value = false
      saveState()
    }
  }, POLL_MS)
}

async function cancel() {
  if (!jobId.value) return
  try { await api.agCancel(jobId.value) } catch (e) { /* ignore */ }
  busy.value = false
  saveState()
}

async function saveSettings() {
  try {
    await api.agSaveConfig({
      model_dir: settings.model_dir,
      output_dir: settings.output_dir,
      easy_negative: settings.easy_negative,
      fix_vae: settings.fix_vae,
      upscale_default: settings.upscale_default,
      default_steps: parseInt(settings.default_steps) || 20,
      default_cfg: parseFloat(settings.default_cfg) || 7,
      default_width: parseInt(settings.default_width) || 512,
      default_height: parseInt(settings.default_height) || 512,
    })
    saveMsg.value = '设置已保存'
    setTimeout(() => { saveMsg.value = '' }, 2000)
  } catch (e) {
    saveMsg.value = `保存失败: ${e.message}`
  }
}

onMounted(async () => {
  restoreState()
  await Promise.all([loadModels(), loadConfig()])
  if (jobId.value && job.value && ACTIVE_STATUS.includes(job.value.status)) {
    busy.value = true
    poll()
  }
})
onUnmounted(() => {
  if (timer.value) clearTimeout(timer.value)
})
</script>

<template>
  <div class="page">
    <div class="page-head">
      <h1>AI 生图</h1>
      <div class="subtitle">本地 SD1.5 - 文生图 / 图生图</div>

      <div class="tabs">
        <button
          v-for="t in tabs"
          :key="t.key"
          class="tab"
          :class="{ active: tab === t.key }"
          @click="tab = t.key"
        >{{ t.label }}</button>
      </div>
    </div>

    <div v-if="tab === 't2i' || tab === 'i2i'" class="page-body no-scroll">
      <div class="gen-layout">
        <!-- 左栏：表单 -->
        <div class="gen-col">
          <div class="section">
            <div class="section-title">{{ tab === 't2i' ? '文生图' : '图生图' }}</div>

            <div v-if="tab === 'i2i'" class="settings-item">
              <label>输入图片</label>
              <div class="control">
                <label class="btn btn-ghost btn-sm" style="cursor:pointer;">
                  选择图片
                  <input type="file" accept="image/*" style="display:none;" @change="onFile" />
                </label>
                <img
                  v-if="previewUrl"
                  :src="previewUrl"
                  style="max-width:120px;max-height:120px;border-radius:var(--radius-sm);border:1px solid var(--border);"
                />
                <span v-if="previewUrl" class="card-meta">{{ resW }}×{{ resH }}</span>
              </div>
            </div>

            <div style="margin-bottom:12px;">
              <label style="font-size:13px;color:var(--text);">提示词</label>
              <textarea
                v-model="form.prompt"
                class="input"
                rows="3"
                style="width:100%;margin-top:6px;resize:vertical;"
                placeholder="1girl, ... 支持中文，质量词可增强效果"
              ></textarea>
            </div>
            <div style="margin-bottom:12px;">
              <label style="font-size:13px;color:var(--text);">负面提示词（开启 EasyNegative 时自动追加）</label>
              <input v-model="form.negative_prompt" class="input" type="text" style="width:100%;margin-top:6px;"
                placeholder="lowres, bad anatomy, bad hands" />
            </div>

            <div class="settings-group">
              <div class="settings-item">
                <label>主模型</label>
                <div class="control">
                  <select v-model="model" class="select" style="flex:1;">
                    <option v-for="m in modelInfo.models" :key="m.name" :value="m.name">{{ m.name }}</option>
                  </select>
                  <span class="badge-tag status">{{ (modelInfo.models.find(m => m.name === model) || {}).type || '' }}</span>
                </div>
              </div>
              <div class="settings-item">
                <label>LoRA（可选）</label>
                <div class="control">
                  <select v-model="lora" class="select" style="flex:1;">
                    <option value="">无</option>
                    <option v-for="l in modelInfo.loras" :key="l" :value="l">{{ l }}</option>
                  </select>
                </div>
              </div>
              <div class="settings-item">
                <label>分辨率</label>
                <div class="control">
                  <select class="select" :value="`${form.width}x${form.height}`"
                    @change="e => { const p = PRESETS.find(x => x.label === e.target.value); if (p) { form.width = p.w; form.height = p.h } }">
                    <option v-for="p in PRESETS" :key="p.label" :value="p.label">{{ p.label }}</option>
                  </select>
                  <input v-model.number="form.width" class="input" type="number" min="256" max="1024" style="width:80px;text-align:center;" />
                  <span style="color:var(--text-faint);">×</span>
                  <input v-model.number="form.height" class="input" type="number" min="256" max="1024" style="width:80px;text-align:center;" />
                </div>
              </div>
              <div class="settings-item">
                <label>步数</label>
                <div class="control">
                  <input v-model.number="form.steps" class="input" type="number" min="5" max="40" style="width:70px;text-align:center;" />
                  <span class="card-meta">建议 15-25</span>
                </div>
              </div>
              <div class="settings-item">
                <label>CFG</label>
                <div class="control">
                  <input v-model.number="form.cfg" class="input" type="number" min="1" max="15" step="0.5" style="width:70px;text-align:center;" />
                  <span class="card-meta">建议 6-9</span>
                </div>
              </div>
              <div class="settings-item">
                <label>Seed</label>
                <div class="control">
                  <input v-model.number="form.seed" class="input" type="number" style="width:120px;text-align:center;" />
                  <span class="card-meta">-1 = 随机</span>
                </div>
              </div>
              <div class="settings-item">
                <label>张数</label>
                <div class="control">
                  <input v-model.number="form.count" class="input" type="number" min="1" max="4" style="width:70px;text-align:center;" />
                </div>
              </div>
              <div class="settings-item">
                <label>超分</label>
                <div class="control">
                  <select v-model="form.upscale" class="select">
                    <option value="none">不超分</option>
                    <option value="x2">x2</option>
                    <option value="x4">x4</option>
                  </select>
                  <span class="card-meta" v-if="modelInfo.aux && (form.upscale === 'x2' && !modelInfo.aux.esrgan_x2 || form.upscale === 'x4' && !modelInfo.aux.esrgan_x4)">模型缺失</span>
                </div>
              </div>
              <div v-if="tab === 'i2i'" class="settings-item">
                <label>强度 (strength)</label>
                <div class="control">
                  <input v-model.number="strength" class="input" type="number" min="0.05" max="0.95" step="0.05" style="width:70px;text-align:center;" />
                  <span class="card-meta">越高越偏离原图</span>
                </div>
              </div>
            </div>

            <div style="margin-top:16px;display:flex;align-items:center;gap:12px;flex-wrap:wrap;">
              <button class="btn btn-primary" :disabled="busy" @click="submit">
                {{ busy ? '生成中...' : '开始生成' }}
              </button>
              <button v-if="busy" class="btn btn-danger" @click="cancel">取消</button>
              <span v-if="error" class="error">{{ error }}</span>
              <span v-else-if="job" class="status-line" :class="{ ok: job.status === 'done', err: job.status === 'error' }">
                {{ statusText() }}
              </span>
            </div>

            <div v-if="job && (job.status === 'running' || job.status === 'loading' || job.status === 'queued')" class="progress" style="margin-top:14px;">
              <div :style="{ width: (job.progress || 0) + '%' }"></div>
            </div>
          </div>
        </div>

        <!-- 右栏：结果 -->
        <div class="gen-col right">
          <div v-if="job && job.images && job.images.length" class="section">
            <div class="section-title">生成结果（{{ job.images.length }} 张）</div>
            <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:12px;">
              <div v-for="img in job.images" :key="img" style="text-align:center;">
                <a :href="img" target="_blank">
                  <img :src="img" style="width:100%;border-radius:var(--radius-sm);border:1px solid var(--border);" loading="lazy" />
                </a>
                <a class="btn btn-ghost btn-sm" style="margin-top:6px;" :href="img" download>下载</a>
              </div>
            </div>
          </div>
          <div v-else class="empty" style="padding:60px;">生成结果将显示于此</div>
        </div>
      </div>
    </div>

    <div v-else-if="tab === 'gallery'" class="page-body">
      <div class="section">
        <div class="section-title">图库
          <button class="btn btn-sm btn-ghost" style="float:right;" @click="loadGallery()">刷新</button>
          <span v-if="galleryTotal" class="status-line" style="float:right;margin-right:12px;">共 {{ galleryTotal }} 张</span>
        </div>
        <div v-if="galleryLoading && !galleryItems.length" class="loading">
          <div class="spinner"></div> 加载中...
        </div>
        <div v-else-if="galleryError" class="error">{{ galleryError }}</div>
        <div v-else-if="!galleryItems.length" class="empty">暂无生成图片</div>
        <div v-else style="display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:12px;">
          <div v-for="it in galleryItems" :key="it.name" style="text-align:center;">
            <a :href="it.url" target="_blank">
              <img
                :src="it.url" :alt="it.name" loading="lazy"
                style="width:100%;aspect-ratio:1;object-fit:cover;border-radius:var(--radius-sm);border:1px solid var(--border);background:var(--surface-2);"
              />
            </a>
            <div class="card-meta" style="margin-top:4px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" :title="it.name">{{ it.name }}</div>
            <div style="display:flex;gap:6px;justify-content:center;margin-top:4px;">
              <a class="btn btn-ghost btn-sm" :href="it.url" download>下载</a>
              <button class="btn btn-danger btn-sm" @click="delGallery(it)">删除</button>
            </div>
          </div>
        </div>
        <div v-if="galleryItems.length && galleryItems.length < galleryTotal" style="padding:12px;text-align:center;">
          <button class="btn btn-sm" :disabled="galleryLoading" @click="loadMoreGallery">
            {{ galleryLoading ? '加载中...' : '加载更多（已显示 ' + galleryItems.length + ' / ' + galleryTotal + '）' }}
          </button>
        </div>
      </div>
    </div>

    <div v-else class="page-body">
      <div class="section" style="max-width:640px;">
        <div class="section-title">设置</div>
        <div class="settings-group">
          <div class="settings-item">
            <label>模型目录</label>
            <input v-model="settings.model_dir" class="input" type="text" style="flex:1;" />
          </div>
          <div class="settings-item">
            <label>输出目录</label>
            <input v-model="settings.output_dir" class="input" type="text" style="flex:1;" />
          </div>
          <div class="settings-item">
            <label>EasyNegative（修手部/画质）</label>
            <label class="switch">
              <input v-model="settings.easy_negative" type="checkbox" />
              <span class="slider"></span>
            </label>
          </div>
          <div class="settings-item">
            <label>VAE 修复（修色彩）</label>
            <label class="switch">
              <input v-model="settings.fix_vae" type="checkbox" />
              <span class="slider"></span>
            </label>
          </div>
          <div class="settings-item">
            <label>默认超分</label>
            <select v-model="settings.upscale_default" class="select">
              <option value="none">不超分</option>
              <option value="x2">x2</option>
              <option value="x4">x4</option>
            </select>
          </div>
          <div class="settings-item">
            <label>默认步数</label>
            <input v-model.number="settings.default_steps" class="input" type="number" style="width:70px;text-align:center;" />
          </div>
          <div class="settings-item">
            <label>默认 CFG</label>
            <input v-model.number="settings.default_cfg" class="input" type="number" style="width:70px;text-align:center;" />
          </div>
        </div>
        <div style="margin-top:16px;display:flex;align-items:center;gap:12px;">
          <button class="btn btn-primary" @click="saveSettings">保存设置</button>
          <span v-if="saveMsg" class="status-line" :class="saveMsg.includes('失败') ? 'err' : 'ok'">{{ saveMsg }}</span>
        </div>
      </div>
    </div>
  </div>
</template>
