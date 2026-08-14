<script setup>
import { ref } from 'vue'
import { api } from '../../api'

const infoFile = ref(null)
const infoLoading = ref(false)
const infoError = ref('')
const info = ref(null)

const procFiles = ref([])
const action = ref('convert')
const format = ref('')
const crf = ref(28)
const start = ref(0)
const duration = ref('')
const procLoading = ref(false)
const procError = ref('')
const procResult = ref(null)

const mergeFiles = ref([])
const mergeLoading = ref(false)
const mergeError = ref('')
const mergeResult = ref(null)

function onInfoFile(e) { infoFile.value = e.target.files[0] || null; info.value = null }
function onProcFiles(e) { procFiles.value = Array.from(e.target.files); procResult.value = null }
function onMergeFiles(e) { mergeFiles.value = Array.from(e.target.files); mergeResult.value = null }

async function doInfo() {
  if (!infoFile.value) { infoError.value = '请选择媒体文件'; return }
  infoLoading.value = true; infoError.value = ''; info.value = null
  try { info.value = await api.tbMediaInfo(infoFile.value) }
  catch (e) { infoError.value = e.message }
  finally { infoLoading.value = false }
}

async function doProcess() {
  if (!procFiles.value.length) { procError.value = '请选择媒体文件'; return }
  procLoading.value = true; procError.value = ''; procResult.value = null
  const extra = {}
  if (action.value === 'clip') {
    extra.start = start.value; extra.duration = duration.value
  }
  if (action.value === 'compress') { extra.crf = crf.value; extra.format = format.value }
  if (action.value === 'convert') extra.format = format.value
  if (action.value === 'audio') extra.format = format.value || 'mp3'
  try {
    procResult.value = await api.tbMediaProcess(procFiles.value, action.value, extra)
  } catch (e) { procError.value = e.message }
  finally { procLoading.value = false }
}

async function doMerge() {
  if (mergeFiles.value.length < 2) { mergeError.value = '请至少选择两个视频'; return }
  mergeLoading.value = true; mergeError.value = ''; mergeResult.value = null
  try { mergeResult.value = await api.tbMediaMerge(mergeFiles.value) }
  catch (e) { mergeError.value = e.message }
  finally { mergeLoading.value = false }
}

function fmtDur(d) {
  if (d === undefined || d === null) return '-'
  const s = Math.round(d)
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60
  return h ? `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}` : `${m}:${String(sec).padStart(2, '0')}`
}
</script>

<template>
  <div class="section">
    <div class="section-title">媒体信息</div>
    <div class="search-bar" style="align-items:stretch;">
      <input type="file" accept="video/*,audio/*" class="input" style="flex:1;" @change="onInfoFile" />
      <button class="btn btn-primary" :disabled="infoLoading || !infoFile" @click="doInfo">查看</button>
    </div>
    <div v-if="infoError" class="error" style="margin-top:10px;">{{ infoError }}</div>
    <div v-if="infoLoading" class="loading" style="margin-top:10px;"><div class="spinner"></div></div>
    <div v-else-if="info" style="margin-top:12px;">
      <table style="width:100%;border-collapse:collapse;font-size:12px;">
        <tbody>
          <tr><td style="padding:4px 8px;color:var(--text-faint);width:120px;">文件</td><td class="mono-block">{{ info.name }}</td></tr>
          <tr><td style="padding:4px 8px;color:var(--text-faint);">时长</td><td class="mono-block">{{ fmtDur(info.duration) }}</td></tr>
          <tr><td style="padding:4px 8px;color:var(--text-faint);">格式</td><td class="mono-block">{{ info.format }}</td></tr>
          <tr v-if="info.video"><td style="padding:4px 8px;color:var(--text-faint);">视频</td><td class="mono-block">{{ info.video.codec }} {{ info.video.width }}x{{ info.video.height }} {{ info.video.fps }}fps</td></tr>
          <tr v-if="info.audio"><td style="padding:4px 8px;color:var(--text-faint);">音频</td><td class="mono-block">{{ info.audio.codec }} {{ info.audio.sample_rate }}Hz {{ info.audio.channels }}ch</td></tr>
        </tbody>
      </table>
    </div>
  </div>

  <div class="section">
    <div class="section-title">音视频处理（转码 / 抽音频 / 剪辑 / 压缩）</div>
    <input type="file" multiple accept="video/*,audio/*" class="input" style="width:100%;" @change="onProcFiles" />
    <div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:10px;align-items:center;">
      <select v-model="action" class="input" style="width:auto;">
        <option value="convert">转码</option>
        <option value="audio">提取音频</option>
        <option value="clip">剪辑片段</option>
        <option value="compress">压缩</option>
      </select>
      <input v-if="action === 'convert' || action === 'audio'" v-model="format" class="input" style="width:100px;" placeholder="格式" />
      <input v-if="action === 'clip'" v-model.number="start" class="input" style="width:90px;" type="number" placeholder="起始秒" />
      <input v-if="action === 'clip'" v-model="duration" class="input" style="width:90px;" placeholder="时长秒" />
      <input v-if="action === 'compress'" v-model.number="crf" class="input" style="width:80px;" type="number" placeholder="CRF" />
      <button class="btn btn-primary" :disabled="procLoading || !procFiles.length" @click="doProcess">
        {{ procLoading ? '处理中...' : '处理' }}
      </button>
    </div>
    <div v-if="procError" class="error" style="margin-top:10px;">{{ procError }}</div>
    <div v-if="procLoading" class="loading" style="margin-top:10px;"><div class="spinner"></div> 处理中（大文件耗时较长）...</div>
    <div v-else-if="procResult" style="margin-top:12px;">
      <div v-for="(r, i) in procResult.results" :key="i" class="mono-block" style="margin-bottom:6px;">
        <span :class="r.ok ? 'ok' : 'fail'">{{ r.ok ? '成功' : '失败' }}</span> {{ r.name }}
        <span v-if="!r.ok" class="fail"> - {{ r.error }}</span>
      </div>
      <div style="margin-top:10px;"><a class="btn btn-ghost" :href="procResult.download">下载处理结果</a></div>
    </div>
  </div>

  <div class="section">
    <div class="section-title">视频合并</div>
    <input type="file" multiple accept="video/*" class="input" style="width:100%;" @change="onMergeFiles" />
    <div style="margin-top:10px;">
      <button class="btn btn-primary" :disabled="mergeLoading || mergeFiles.length < 2" @click="doMerge">
        {{ mergeLoading ? '合并中...' : '合并' }}
      </button>
      <span class="hint" style="margin-left:10px;">已选 {{ mergeFiles.length }} 个文件</span>
    </div>
    <div v-if="mergeError" class="error" style="margin-top:10px;">{{ mergeError }}</div>
    <div v-if="mergeLoading" class="loading" style="margin-top:10px;"><div class="spinner"></div></div>
    <div v-else-if="mergeResult" style="margin-top:12px;">
      <div class="mono-block">已合并 {{ mergeResult.files }} 个文件</div>
      <div style="margin-top:10px;"><a class="btn btn-ghost" :href="mergeResult.download">下载 merged.mp4</a></div>
    </div>
  </div>
</template>
