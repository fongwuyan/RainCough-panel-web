<script setup>
import { ref, reactive, onBeforeUnmount, nextTick, watch } from 'vue'
import { api } from '../../api'
import { SkinViewer, WalkingAnimation } from 'skinview3d'

const model = ref('wide')
const models = [
  { key: 'wide', label: 'Steve (宽手臂)' },
  { key: 'slim', label: 'Alex (瘦手臂)' },
]
const srcUrl = ref('')
const busy = ref(false)
const error = ref('')
const result = ref(null)

const viewerRef = ref(null)
const overlayRef = ref(null)
let viewer = null

const paintModels = ref([])
const paintModel = ref('')
const paintStrength = ref(0.4)
const paintSteps = ref(20)
const paintCfg = ref(7)
const paintPrompt = ref('masterpiece, best quality, anime style, cel shading, clean lineart, detailed, colorful')
const paintNegative = ref('bad anatomy, deformed, extra limbs, watermark, text, blurry, lowres')
const paintBusy = ref(false)
const paintProgress = ref(0)
const paintRegion = ref('')
const paintResult = ref(null)
let paintTimer = null

const tab = ref('image')
const textPrompt = ref('一个穿着机械装甲的冒险者，蓝色能量核心')
const textStyle = ref('mecha')
const textTone = ref('cool')
const textStrength = ref(3)
const textBody = ref('wide')
const textStyles = ref({})
const textTones = ref({})
const textBusy = ref(false)
const textProgress = ref(0)
const textResult = ref(null)
const textHistory = ref([])
let textTimer = null

const previewUrl = ref('')
const previewError = ref('')

async function onPreviewFile(e) {
  const f = e.target.files[0]
  if (!f) return
  previewError.value = ''
  const reader = new FileReader()
  reader.onload = async () => {
    const b64 = reader.result.split(',')[1]
    previewUrl.value = 'data:image/png;base64,' + b64
    await nextTick()
    show3D(b64)
  }
  reader.readAsDataURL(f)
}

const PARAMS = [
  { key: 'center_x', label: '中心 X', min: 20, max: 80, step: 0.5, unit: '%' },
  { key: 'head_top', label: '头顶 Y', min: 1, max: 50, step: 0.5, unit: '%' },
  { key: 'head_bot', label: '下巴 Y', min: 5, max: 60, step: 0.5, unit: '%' },
  { key: 'head_half_w', label: '头半宽', min: 8, max: 30, step: 0.5, unit: '%' },
  { key: 'body_bot', label: '腰/胯 Y', min: 15, max: 85, step: 0.5, unit: '%' },
  { key: 'body_half_w', label: '躯干半宽', min: 18, max: 45, step: 0.5, unit: '%' },
  { key: 'arm_w', label: '手臂宽', min: 5, max: 22, step: 0.5, unit: '%' },
  { key: 'arm_half_w', label: '手臂半宽(旧)', min: 5, max: 14, step: 0.5, unit: '%' },
  { key: 'leg_w', label: '腿宽', min: 8, max: 30, step: 0.5, unit: '%' },
  { key: 'leg_bot', label: '脚底 Y', min: 50, max: 99, step: 0.5, unit: '%' },
  { key: 'lighting', label: '光照(明暗)', min: 0, max: 100, step: 1, unit: '%' },
  { key: 'overlay_alpha', label: '叠层透明度', min: 0, max: 255, step: 1, unit: '' },
]
const bgRemoval = ref(true)
const params = reactive({})

function onFile(e) {
  const f = e.target.files[0]
  if (!f) return
  error.value = ''
  srcUrl.value = URL.createObjectURL(f)
  result.value = null
  detect()
}

async function detect() {
  if (!srcUrl.value) return
  try {
    const f = await fetch(srcUrl.value).then(r => r.blob())
    const fd = new FormData()
    fd.append('file', f)
    fd.append('bg_removal', bgRemoval.value ? '1' : '0')
    const r = await api.mcskinDetect(fd)
    if (r.ok) {
      for (const k of Object.keys(params)) delete params[k]
      for (const k in r.params) if (k !== '_body_h' && k !== 'bg_removal') params[k] = Number(r.params[k])
    }
  } catch (err) { /* keep defaults */ }
  drawOverlay()
}

async function convert() {
  if (!srcUrl.value) { error.value = '请先选择图片'; return }
  busy.value = true; error.value = ''
  try {
    const f = await fetch(srcUrl.value).then(r => r.blob())
    const fd = new FormData()
    fd.append('file', f)
    fd.append('model', model.value)
    fd.append('bg_removal', bgRemoval.value ? '1' : '0')
    for (const k in params) if (params[k] != null) fd.append('p_' + k, params[k])
    const r = await api.mcskinConvert(fd)
    result.value = r
    await nextTick()
    show3D(r.png)
  } catch (err) { error.value = err.message }
  finally { busy.value = false }
}

function bytesToBlob(b64) {
  const bin = atob(b64)
  const arr = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i)
  return new Blob([arr], { type: 'image/png' })
}

async function loadPaintModels() {
  try {
    const r = await api.mcskinPaintModels()
    const list = (r.models && r.models.models) || []
    paintModels.value = list
    if (list.length && !paintModel.value) paintModel.value = list[0].name
  } catch (err) { /* ignore */ }
}

const REGION_NAMES = { head: '头部', torso: '躯干', arm_l: '左臂', arm_r: '右臂', leg_l: '左腿', leg_r: '右腿' }

async function paint() {
  if (!srcUrl.value) { error.value = '请先选择图片'; return }
  if (!paintModel.value) { error.value = '未找到可用 AI 模型'; return }
  paintBusy.value = true; paintProgress.value = 0; paintRegion.value = ''
  paintResult.value = null
  try {
    const f = await fetch(srcUrl.value).then(r => r.blob())
    const fd = new FormData()
    fd.append('file', f)
    fd.append('model', paintModel.value)
    fd.append('body', model.value)
    fd.append('bg_removal', bgRemoval.value ? '1' : '0')
    fd.append('prompt', paintPrompt.value)
    fd.append('negative_prompt', paintNegative.value)
    fd.append('steps', paintSteps.value)
    fd.append('cfg', paintCfg.value)
    fd.append('strength', paintStrength.value)
    fd.append('seed', -1)
    for (const k in params) if (params[k] != null) fd.append('p_' + k, params[k])
    const r = await api.mcskinPaint(fd)
    if (!r.ok) throw new Error(r.error || '提交失败')
    await pollPaint(r.job_id)
  } catch (err) { error.value = err.message; paintBusy.value = false }
}

async function pollPaint(jid) {
  const tick = async () => {
    const s = await api.mcskinPaintStatus(jid)
    if (s.error) { error.value = s.error; paintBusy.value = false; paintTimer = null; return }
    paintProgress.value = s.progress || 0
    paintRegion.value = s.region ? (REGION_NAMES[s.region] || s.region) : ''
    if (s.status === 'done') {
      paintBusy.value = false; paintTimer = null
      paintResult.value = s
      await nextTick()
      show3D(s.png)
    } else if (s.status === 'error') {
      paintBusy.value = false; paintTimer = null
      error.value = s.error || 'AI 绘制失败'
    } else {
      paintTimer = setTimeout(tick, 3000)
    }
  }
  tick()
}

onBeforeUnmount(() => {
  if (paintTimer) clearTimeout(paintTimer)
  if (textTimer) clearTimeout(textTimer)
  if (viewer) { viewer.dispose(); viewer = null }
})

loadPaintModels()
loadTextSkin()

async function loadTextSkin() {
  try {
    const [styles, models] = await Promise.all([api.mcskinTextStyles(), api.mcskinTextModels()])
    if (styles.ok) { textStyles.value = styles.styles || {}; textTones.value = styles.tones || {} }
    const keys = Object.keys(textStyles.value)
    if (keys.length && !textStyles.value[textStyle.value]) textStyle.value = keys[0]
    await loadHistory()
  } catch (err) { /* ignore */ }
}

async function loadHistory() {
  try {
    const r = await api.mcskinTextHistory()
    if (r.ok) textHistory.value = r.history || []
  } catch (err) { /* ignore */ }
}

async function text2skin() {
  if (!textPrompt.value.trim()) { error.value = '请输入角色描述'; return }
  textBusy.value = true; textProgress.value = 0; textResult.value = null; error.value = ''
  try {
    const r = await api.mcskinText2Skin({
      prompt: textPrompt.value, style: textStyle.value, tone: textTone.value,
      strength: textStrength.value, body: textBody.value,
    })
    if (!r.ok) throw new Error(r.error || '提交失败')
    await pollText(r.job_id)
  } catch (err) { error.value = err.message; textBusy.value = false }
}

async function pollText(jid) {
  const tick = async () => {
    const s = await api.mcskinTextStatus(jid)
    if (s.error) { error.value = s.error; textBusy.value = false; textTimer = null; return }
    textProgress.value = s.progress || 0
    if (s.status === 'done') {
      textBusy.value = false; textTimer = null
      textResult.value = s
      await loadHistory()
      await nextTick()
      show3D(s.candidate.png)
    } else if (s.status === 'error') {
      textBusy.value = false; textTimer = null
      error.value = s.error || '文生皮肤失败'
    } else {
      textTimer = setTimeout(tick, 2500)
    }
  }
  tick()
}

async function regenerate(jid) {
  const r = await api.mcskinTextRegenerate(jid)
  if (!r.ok) { error.value = r.error || '重新生成失败'; return }
  textBusy.value = true; textProgress.value = 0; textResult.value = null
  await pollText(r.job_id)
}

async function feedback(jid, like) {
  try {
    const r = await api.mcskinTextFeedback(jid, like)
    if (r.ok) await loadHistory()
  } catch (err) { /* ignore */ }
}

function downloadText() {
  if (!textResult.value || !textResult.value.candidate) return
  const blob = bytesToBlob(textResult.value.candidate.png)
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = '文生皮肤_' + new Date().toISOString().replace(/[:.]/g, '-') + '.png'
  a.click()
  URL.revokeObjectURL(a.href)
}

function downloadHistory(item) {
  const c = item.candidates && item.candidates[0]
  if (!c) return
  const blob = bytesToBlob(c.png)
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = '文生皮肤_' + item.id + '.png'
  a.click()
  URL.revokeObjectURL(a.href)
}

function groupHistory() {
  const groups = { today: [], yesterday: [], earlier: [] }
  const now = new Date()
  const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
  const startYesterday = startToday - 86400000
  for (const item of textHistory.value) {
    const t = (item.created || 0) * 1000
    if (t >= startToday) groups.today.push(item)
    else if (t >= startYesterday) groups.yesterday.push(item)
    else groups.earlier.push(item)
  }
  return groups
}

function show3D(b64) {
  const url = URL.createObjectURL(bytesToBlob(b64))
  if (!viewer) {
    viewer = new SkinViewer({ canvas: viewerRef.value, width: 320, height: 320 })
    viewer.controls.enableZoom = true
    viewer.autoRotate = true
    viewer.autoRotateSpeed = 2.0
  }
  viewer.playerObject.modelType = model.value
  viewer.animation = new WalkingAnimation()
  viewer.animation.speed = 0.8
  viewer.loadSkin(url)
}

function downloadPng() {
  if (!result.value) return
  const blob = bytesToBlob(result.value.png)
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = result.value.filename || 'skin.png'
  a.click()
  URL.revokeObjectURL(a.href)
}

function downloadPaint() {
  if (!paintResult.value) return
  const blob = bytesToBlob(paintResult.value.png)
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = '皮肤_AI_%s.png'.replace('%s', new Date().toISOString().replace(/[:.]/g, '-'))
  a.click()
  URL.revokeObjectURL(a.href)
}

function drawOverlay() {
  const cv = overlayRef.value
  const img = new Image()
  img.onload = () => {
    cv.width = img.width; cv.height = img.height
    const ctx = cv.getContext('2d')
    ctx.drawImage(img, 0, 0)
    const W = cv.width, H = cv.height
    const cx = W * (params.center_x || 50) / 100
    const hw = W * (params.head_half_w || 20) / 100
    const bw = W * (params.body_half_w || 35) / 100
    const aw = W * (params.arm_half_w || 9) / 100
    const ht = H * (params.head_top || 5) / 100
    const hb = H * (params.head_bot || 17) / 100
    const bb = H * (params.body_bot || 55) / 100
    const lb = H * (params.leg_bot || 92) / 100
    const boxes = [
      { r: [cx - hw, ht, cx + hw, hb], c: '#ff5252', label: '头' },
      { r: [cx - bw, hb, cx + bw, bb], c: '#40c4ff', label: '躯干' },
      { r: [cx - bw - aw, hb, cx - bw, bb], c: '#69f0ae', label: '左臂' },
      { r: [cx + bw, hb, cx + bw + aw, bb], c: '#69f0ae', label: '右臂' },
      { r: [cx - bw * 0.6, bb, cx, lb], c: '#ffd740', label: '左腿' },
      { r: [cx, bb, cx + bw * 0.6, lb], c: '#ffd740', label: '右腿' },
    ]
    for (const b of boxes) {
      const [x0, y0, x1, y1] = b.r
      ctx.strokeStyle = b.c; ctx.lineWidth = 2
      ctx.strokeRect(x0, y0, x1 - x0, y1 - y0)
      ctx.fillStyle = b.c
      ctx.font = '14px sans-serif'
      ctx.fillText(b.label, x0 + 3, y0 + 16)
    }
  }
  img.src = srcUrl.value
}

watch(params, () => drawOverlay(), { deep: true })

</script>

<template>
  <div>
    <h1>图片转 MC Java 皮肤</h1>
    <div class="subtitle">上传全身人物立绘，自动定位分区；如不满意可用滑块微调再生成。</div>

    <div class="section" style="margin-top:16px;">
      <div class="form-row">
        <span v-for="t in [{key:'text',label:'文生皮肤'},{key:'image',label:'图生皮肤'},{key:'preview',label:'上传预览'}]"
          :key="t.key" class="tag-chip" :class="tab === t.key ? 'ok' : ''" style="cursor:pointer;"
          @click="tab = t.key">{{ t.label }}</span>
      </div>
    </div>

    <div v-if="error" class="error" style="margin-top:12px;">{{ error }}</div>

    <div v-if="tab === 'text'" class="section" style="margin-top:16px;">
      <div class="section-title">文生皮肤（本地 LLM 生成配色规格 → 程序化渲染）</div>
      <div class="form-row">
        <span class="form-label" style="width:90px;">角色描述</span>
        <input v-model="textPrompt" class="input" style="flex:1;" placeholder="描述你想生成的角色，如：穿着机械装甲的冒险者" />
      </div>
      <div class="form-row">
        <span class="form-label" style="width:90px;">风格</span>
        <span v-for="(desc, k) in textStyles" :key="k" class="tag-chip" :class="textStyle === k ? 'ok' : ''"
          style="cursor:pointer;font-size:12px;" :title="desc" @click="textStyle = k">{{ k }}</span>
      </div>
      <div class="form-row">
        <span class="form-label" style="width:90px;">色调</span>
        <span v-for="(desc, k) in textTones" :key="k" class="tag-chip" :class="textTone === k ? 'ok' : ''"
          style="cursor:pointer;font-size:12px;" :title="desc" @click="textTone = k">{{ k }}</span>
      </div>
      <div class="form-row" style="flex-wrap:wrap;">
        <span class="form-label" style="width:90px;">风格强度</span>
        <input type="range" min="1" max="5" step="1" v-model.number="textStrength" class="range" style="flex:1;min-width:160px;" />
        <span class="hint" style="width:120px;font-size:12px;text-align:right;">{{ ['很低','偏低','中等','偏高','很高'][textStrength - 1] }}</span>
        <span class="form-label" style="width:90px;margin-left:8px;">模型</span>
        <select v-model="textBody" class="input" style="flex:1;min-width:120px;">
          <option value="wide">Steve (宽手臂)</option>
          <option value="slim">Alex (瘦手臂)</option>
        </select>
      </div>
      <div style="margin-top:12px;display:flex;align-items:center;gap:12px;flex-wrap:wrap;">
        <button class="btn btn-primary" :disabled="textBusy" @click="text2skin">
          {{ textBusy ? '生成中...' : '生成皮肤' }}
        </button>
        <span class="hint" style="font-size:12px;">CPU 推理约 5-15 秒</span>
      </div>
      <div v-if="textBusy" style="margin-top:10px;">
        <div style="height:8px;background:rgba(255,255,255,.1);border-radius:4px;overflow:hidden;">
          <div style="height:100%;background:linear-gradient(90deg,#7c4dff,#40c4ff);transition:width .4s;border-radius:4px;" :style="{ width: textProgress + '%' }"></div>
        </div>
        <div class="hint" style="font-size:12px;margin-top:4px;">{{ textProgress }}%</div>
      </div>
      <div v-if="textResult && textResult.candidate" style="margin-top:12px;display:flex;gap:20px;flex-wrap:wrap;">
        <div>
          <div class="hint" style="font-size:12px;margin-bottom:6px;">3D 预览</div>
          <div style="width:320px;height:320px;background:linear-gradient(135deg,rgba(0,0,0,.35),rgba(0,0,0,.55));border-radius:10px;overflow:hidden;">
            <canvas ref="viewerRef" width="320" height="320"></canvas>
          </div>
        </div>
        <div>
          <div class="hint" style="font-size:12px;margin-bottom:6px;">皮肤贴图</div>
          <img :src="'data:image/png;base64,' + textResult.candidate.png" style="width:256px;height:256px;image-rendering:pixelated;border:1px solid rgba(255,255,255,.15);border-radius:6px;" />
          <div style="margin-top:10px;display:flex;gap:8px;flex-wrap:wrap;">
            <button class="btn btn-primary" @click="downloadText">下载 PNG</button>
            <button class="btn" @click="regenerate(textResult.id)">重新生成</button>
            <button class="btn" @click="feedback(textResult.id, true)">👍 喜欢</button>
            <button class="btn" @click="feedback(textResult.id, false)">👎 不喜欢</button>
          </div>
        </div>
      </div>

      <div class="section" style="margin-top:16px;">
        <div class="section-title">生成历史（{{ textHistory.length }} 条）</div>
        <div v-if="!textHistory.length" class="hint" style="font-size:12px;">暂无历史记录</div>
        <div v-for="(items, gk) in groupHistory()" :key="gk">
          <template v-if="items.length">
            <div class="hint" style="font-size:12px;margin:10px 0 6px;color:#90a4ae;">
              {{ gk === 'today' ? '今天' : (gk === 'yesterday' ? '昨天' : '更早') }}
            </div>
            <div v-for="item in items" :key="item.id" style="display:flex;align-items:center;gap:12px;padding:8px;border:1px solid rgba(255,255,255,.1);border-radius:8px;margin-bottom:8px;flex-wrap:wrap;">
              <img :src="'data:image/png;base64,' + (item.candidates && item.candidates[0] && item.candidates[0].png)" style="width:48px;height:48px;image-rendering:pixelated;border-radius:4px;border:1px solid rgba(255,255,255,.1);" />
              <div style="flex:1;min-width:200px;">
                <div style="font-size:13px;">{{ item.prompt }}</div>
                <div class="hint" style="font-size:11px;">风格:{{ item.style }} · 色调:{{ item.tone }} · 强度:{{ item.strength }} · {{ new Date(item.created * 1000).toLocaleTimeString() }}</div>
              </div>
              <div style="display:flex;gap:6px;flex-wrap:wrap;">
                <button class="btn" style="font-size:12px;padding:4px 8px;" @click="regenerate(item.id)">重新生成</button>
                <button class="btn" style="font-size:12px;padding:4px 8px;" @click="downloadHistory(item)">下载</button>
                <button class="btn" style="font-size:12px;padding:4px 8px;" @click="feedback(item.id, true)">👍</button>
                <button class="btn" style="font-size:12px;padding:4px 8px;" @click="feedback(item.id, false)">👎</button>
                <span v-if="item.candidates && item.candidates[0] && item.candidates[0].feedback" class="hint" style="font-size:11px;align-self:center;">
                  {{ item.candidates[0].feedback === 'like' ? '👍' : '👎' }}
                </span>
              </div>
            </div>
          </template>
        </div>
      </div>
    </div>

    <div v-if="tab === 'image'" class="section" style="margin-top:16px;">
      <div class="section-title">选择立绘</div>
      <div class="form-row">
        <span class="form-label">模型</span>
        <span v-for="m in models" :key="m.key" class="tag-chip" :class="model === m.key ? 'ok' : ''"
          style="cursor:pointer;" @click="model = m.key">{{ m.label }}</span>
      </div>
      <div class="form-row">
        <span class="form-label">图片</span>
        <input type="file" accept=".png,.jpg,.jpeg,.webp,.gif,.bmp" class="input" @change="onFile" />
      </div>
      <div class="form-row">
        <span class="form-label">去背景</span>
        <label style="display:inline-flex;align-items:center;gap:6px;font-size:13px;cursor:pointer;">
          <input type="checkbox" v-model="bgRemoval" @change="detect" /> 自动去除背景（白底/花底时开启）
        </label>
      </div>
      <div v-if="srcUrl" style="margin-top:10px;display:flex;align-items:flex-start;gap:16px;flex-wrap:wrap;">
        <div>
          <img :src="srcUrl" style="max-height:300px;max-width:220px;border-radius:8px;object-fit:contain;background:rgba(0,0,0,.25);" />
        </div>
        <div style="min-width:0;flex:1;">
          <div class="hint" style="font-size:12px;margin-bottom:8px;">分区预览：头 / 躯干 / 左右臂 / 左右腿</div>
          <canvas ref="overlayRef" style="width:auto;height:auto;max-width:100%;max-height:340px;border-radius:8px;border:1px solid rgba(255,255,255,.12);" />
        </div>
      </div>
      <div v-if="srcUrl" class="section" style="margin-top:14px;">
        <div class="section-title">分区微调</div>
        <div v-for="p in PARAMS" :key="p.key" class="form-row" style="flex-wrap:wrap;">
          <span class="form-label" style="width:90px;">{{ p.label }}</span>
          <input type="range" :min="p.min" :max="p.max" :step="p.step" class="range"
            :value="params[p.key] ?? 50" @input="params[p.key] = parseFloat($event.target.value)" style="flex:1;min-width:160px;" />
          <span class="hint" style="width:64px;font-size:12px;text-align:right;">{{ (params[p.key] ?? 50).toFixed(1) }}{{ p.unit }}</span>
        </div>
      </div>
      <div style="margin-top:14px;">
        <button class="btn btn-primary" :disabled="busy" @click="convert">{{ busy ? '转换中...' : '生成皮肤' }}</button>
      </div>
    </div>

    <div class="section" style="margin-top:16px;">
      <div class="section-title">AI 精细绘画（本地 SD1.5 逐区重绘，CPU 需数分钟）</div>
      <div class="form-row">
        <span class="form-label" style="width:90px;">模型</span>
        <select v-model="paintModel" class="input" style="flex:1;">
          <option v-for="m in paintModels" :key="m.name" :value="m.name">{{ m.name }}</option>
        </select>
      </div>
      <div class="form-row">
        <span class="form-label" style="width:90px;">提示词</span>
        <input v-model="paintPrompt" class="input" style="flex:1;" placeholder="描述画风/内容" />
      </div>
      <div class="form-row">
        <span class="form-label" style="width:90px;">负面词</span>
        <input v-model="paintNegative" class="input" style="flex:1;" placeholder="不希望出现的内容" />
      </div>
      <div class="form-row" style="flex-wrap:wrap;">
        <span class="form-label" style="width:90px;">强度</span>
        <input type="range" min="0.05" max="0.9" step="0.05" v-model.number="paintStrength" class="range" style="flex:1;min-width:120px;" />
        <span class="hint" style="width:90px;font-size:12px;text-align:right;">{{ paintStrength.toFixed(2) }}（高=更自由）</span>
        <span class="form-label" style="width:90px;margin-left:8px;">步数</span>
        <input type="range" min="10" max="40" step="1" v-model.number="paintSteps" class="range" style="flex:1;min-width:120px;" />
        <span class="hint" style="width:44px;font-size:12px;text-align:right;">{{ paintSteps }}</span>
        <span class="form-label" style="width:90px;margin-left:8px;">CFG</span>
        <input type="range" min="1" max="15" step="0.5" v-model.number="paintCfg" class="range" style="flex:1;min-width:120px;" />
        <span class="hint" style="width:44px;font-size:12px;text-align:right;">{{ paintCfg.toFixed(1) }}</span>
      </div>
      <div style="margin-top:12px;display:flex;align-items:center;gap:12px;flex-wrap:wrap;">
        <button class="btn btn-primary" :disabled="paintBusy || !paintModel" @click="paint">
          {{ paintBusy ? 'AI 绘制中...' : '开始 AI 精细绘画' }}
        </button>
        <span v-if="paintRegion" class="hint" style="font-size:12px;">正在重绘：{{ paintRegion }}</span>
      </div>
      <div v-if="paintBusy" style="margin-top:10px;">
        <div style="height:8px;background:rgba(255,255,255,.1);border-radius:4px;overflow:hidden;">
          <div style="height:100%;background:linear-gradient(90deg,#7c4dff,#40c4ff);transition:width .4s;border-radius:4px;" :style="{ width: paintProgress + '%' }"></div>
        </div>
        <div class="hint" style="font-size:12px;margin-top:4px;">{{ paintProgress }}%</div>
      </div>
      <div v-if="paintResult" style="margin-top:12px;display:flex;gap:20px;flex-wrap:wrap;">
        <div>
          <div class="hint" style="font-size:12px;margin-bottom:6px;">3D 预览（AI 重绘后）</div>
          <div style="width:320px;height:320px;background:linear-gradient(135deg,rgba(0,0,0,.35),rgba(0,0,0,.55));border-radius:10px;overflow:hidden;">
            <canvas ref="viewerRef" width="320" height="320"></canvas>
          </div>
        </div>
        <div>
          <div class="hint" style="font-size:12px;margin-bottom:6px;">AI 皮肤贴图</div>
          <img :src="'data:image/png;base64,' + paintResult.png" style="width:256px;height:256px;image-rendering:pixelated;border:1px solid rgba(255,255,255,.15);border-radius:6px;" />
          <div style="margin-top:10px;">
            <button class="btn btn-primary" @click="downloadPaint">下载 PNG</button>
          </div>
        </div>
      </div>
    </div>

    <div v-if="result" class="section" style="margin-top:16px;">
      <div class="section-title">转换结果 ({{ result.model === 'slim' ? 'Alex' : 'Steve' }} · 64×64)</div>
      <div style="display:flex;gap:20px;flex-wrap:wrap;margin-top:12px;">
        <div>
          <div class="hint" style="font-size:12px;margin-bottom:6px;">3D 预览（拖拽旋转）</div>
          <div style="width:320px;height:320px;background:linear-gradient(135deg,rgba(0,0,0,.35),rgba(0,0,0,.55));border-radius:10px;overflow:hidden;">
            <canvas ref="viewerRef" width="320" height="320"></canvas>
          </div>
        </div>
        <div>
          <div class="hint" style="font-size:12px;margin-bottom:6px;">皮肤贴图</div>
          <img :src="'data:image/png;base64,' + result.png" style="width:256px;height:256px;image-rendering:pixelated;border:1px solid rgba(255,255,255,.15);border-radius:6px;" />
          <div style="margin-top:10px;">
            <button class="btn btn-primary" @click="downloadPng">下载 PNG</button>
          </div>
        </div>
      </div>
    </div>

    <div v-if="tab === 'preview'" class="section" style="margin-top:16px;">
      <div class="section-title">上传预览（导入已有 64×64 皮肤）</div>
      <div class="form-row">
        <span class="form-label">皮肤</span>
        <input type="file" accept=".png" class="input" @change="onPreviewFile" />
      </div>
      <div v-if="previewError" class="error" style="margin-top:8px;">{{ previewError }}</div>
      <div v-if="previewUrl" style="margin-top:12px;display:flex;gap:20px;flex-wrap:wrap;">
        <div>
          <div class="hint" style="font-size:12px;margin-bottom:6px;">3D 预览（拖拽旋转）</div>
          <div style="width:320px;height:320px;background:linear-gradient(135deg,rgba(0,0,0,.35),rgba(0,0,0,.55));border-radius:10px;overflow:hidden;">
            <canvas ref="viewerRef" width="320" height="320"></canvas>
          </div>
        </div>
        <div>
          <div class="hint" style="font-size:12px;margin-bottom:6px;">皮肤贴图</div>
          <img :src="previewUrl" style="width:256px;height:256px;image-rendering:pixelated;border:1px solid rgba(255,255,255,.15);border-radius:6px;" />
        </div>
      </div>
    </div>
  </div>
</template>
