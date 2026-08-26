<script setup>
import { ref } from 'vue'
import { api } from '../../api'

const mode = ref('info')
const file = ref(null)
const loading = ref(false)
const error = ref('')
const result = ref(null)

function onFile(e) {
  const f = e.target.files[0]
  if (f) { file.value = f; result.value = null; error.value = '' }
}

async function doRun() {
  if (!file.value) { error.value = '请选择融合文件'; return }
  loading.value = true; error.value = ''; result.value = null
  try {
    if (mode.value === 'info') result.value = await api.vmInfo(file.value)
    else result.value = await api.vmExtract(file.value)
  } catch (e) { error.value = e.message }
  finally { loading.value = false }
}

function fmtSize(n) {
  const u = ['B', 'KB', 'MB', 'GB', 'TB']
  let i = 0; let v = n
  while (v >= 1024 && i < u.length - 1) { v /= 1024; i++ }
  return `${v.toFixed(1)} ${u[i]}`
}
</script>

<template>
  <div class="section">
    <div class="section-title">融合文件信息 / 提取</div>
    <div class="tabs">
      <button class="tab" :class="{ active: mode === 'info' }" @click="mode = 'info'">查看信息</button>
      <button class="tab" :class="{ active: mode === 'extract' }" @click="mode = 'extract'">提取压缩包</button>
    </div>

    <div class="search-bar" style="align-items:stretch;margin-top:10px;">
      <input type="file" class="input" style="flex:1;" @change="onFile" />
      <button class="btn btn-primary" :disabled="loading || !file" @click="doRun">
        {{ loading ? '处理中...' : (mode === 'info' ? '查看信息' : '提取') }}
      </button>
    </div>

    <div v-if="error" class="error" style="margin-top:12px;">{{ error }}</div>
    <div v-if="loading" class="loading" style="margin-top:12px;"><div class="spinner"></div> 处理中...</div>

    <div v-else-if="result && mode === 'info'" class="mono-block" style="margin-top:12px;line-height:1.9;">
      <div><b>嵌入类型</b>: {{ result.arch_type }}</div>
      <div><b>嵌入大小</b>: {{ fmtSize(result.arch_size) }} ({{ result.arch_size }} B)</div>
      <div><b>嵌入偏移</b>: {{ result.arch_offset }}</div>
      <div><b>视频大小</b>: {{ fmtSize(result.video_size) }}</div>
      <div><b>文件总大小</b>: {{ fmtSize(result.total_size) }}</div>
      <div>
        <b>CRC32</b>: {{ result.crc32 }}
        <span :class="result.crc_ok ? 'ok' : 'fail'">{{ result.crc_ok ? ' ✔ 校验通过' : ' ✘ 校验失败' }}</span>
      </div>
    </div>

    <div v-else-if="result && mode === 'extract'" style="margin-top:12px;">
      <div class="ok">提取完成：{{ result.arch_type }} ({{ fmtSize(result.arch_size) }})</div>
      <div style="margin-top:10px;"><a class="btn btn-ghost" :href="result.download">下载压缩包</a></div>
    </div>
  </div>
</template>
