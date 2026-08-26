<script setup>
import { ref } from 'vue'
import { api } from '../../api'

const video = ref(null)
const archive = ref(null)
const name = ref('')
const loading = ref(false)
const error = ref('')
const result = ref(null)

function onVideo(e) { const f = e.target.files[0]; if (f) { video.value = f; result.value = null; error.value = '' } }
function onArchive(e) { const f = e.target.files[0]; if (f) { archive.value = f; result.value = null; error.value = '' } }

async function doMerge() {
  if (!video.value || !archive.value) { error.value = '请选择视频和压缩包'; return }
  loading.value = true; error.value = ''; result.value = null
  try { result.value = await api.vmMerge(video.value, archive.value, name.value) }
  catch (e) { error.value = e.message }
  finally { loading.value = false }
}

const TYPE_NAMES = { 1: 'ZIP', 2: '7z', 3: 'RAR' }

function fmtSize(n) {
  const u = ['B', 'KB', 'MB', 'GB', 'TB']
  let i = 0; let v = n
  while (v >= 1024 && i < u.length - 1) { v /= 1024; i++ }
  return `${v.toFixed(1)} ${u[i]}`
}
</script>

<template>
  <div class="section">
    <div class="section-title">视频 + 压缩包 融合</div>
    <div class="hint" style="margin-bottom:8px;">
      融合后文件仍可正常播放；若压缩包是 ZIP，可直接被 7z 等工具解出；7z/RAR 需通过本插件提取。
    </div>

    <div style="display:flex;gap:10px;flex-wrap:wrap;align-items:center;">
      <div style="flex:1;min-width:220px;">
        <label style="font-size:12px;color:var(--text-faint);display:block;margin-bottom:4px;">视频文件</label>
        <input type="file" class="input" @change="onVideo" />
      </div>
      <div style="flex:1;min-width:220px;">
        <label style="font-size:12px;color:var(--text-faint);display:block;margin-bottom:4px;">压缩包 (zip/7z/rar)</label>
        <input type="file" class="input" @change="onArchive" />
      </div>
    </div>
    <div style="display:flex;gap:10px;align-items:center;margin-top:10px;">
      <input v-model="name" class="input" style="flex:1;min-width:140px;" placeholder="输出文件名（可选）" />
      <button class="btn btn-primary" :disabled="loading || !video || !archive" @click="doMerge">
        {{ loading ? '融合中...' : '开始融合' }}
      </button>
    </div>

    <div v-if="error" class="error" style="margin-top:12px;">{{ error }}</div>
    <div v-if="loading" class="loading" style="margin-top:12px;"><div class="spinner"></div> 融合中...</div>

    <div v-else-if="result" style="margin-top:12px;">
      <div class="ok">融合完成</div>
      <div class="mono-block" style="margin-top:8px;line-height:1.9;">
        <div><b>视频</b>: {{ result.video }}</div>
        <div><b>压缩包</b>: {{ result.archive }} ({{ TYPE_NAMES[result.arch_type] }}, {{ fmtSize(result.arch_size) }})</div>
        <div><b>输出</b>: {{ fmtSize(result.output_size) }}</div>
        <div><b>CRC32</b>: {{ result.crc32 }}</div>
      </div>
      <div style="margin-top:10px;"><a class="btn btn-ghost" :href="result.download">下载融合文件</a></div>
    </div>
  </div>
</template>
