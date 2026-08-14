<script setup>
import { ref } from 'vue'
import { api } from '../../api'

const file = ref(null)
const loading = ref(false)
const error = ref('')
const info = ref(null)

function onFile(e) {
  const f = e.target.files[0]
  if (f) { file.value = f; info.value = null; error.value = '' }
}

async function doInfo() {
  if (!file.value) { error.value = '请选择文件'; return }
  loading.value = true; error.value = ''; info.value = null
  try { info.value = (await api.mtInfo(file.value)).info }
  catch (e) { error.value = e.message }
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
    <div class="section-title">文件信息</div>
    <div class="search-bar" style="align-items:stretch;">
      <input type="file" class="input" style="flex:1;" @change="onFile" />
      <button class="btn btn-primary" :disabled="loading || !file" @click="doInfo">
        {{ loading ? '解析中...' : '解析' }}
      </button>
    </div>

    <div v-if="error" class="error" style="margin-top:12px;">{{ error }}</div>
    <div v-if="loading" class="loading" style="margin-top:12px;"><div class="spinner"></div> 解析中...</div>

    <div v-else-if="info" class="mono-block" style="margin-top:14px;line-height:1.9;">
      <div><b>名称</b>: {{ info.name }}</div>
      <div><b>类型</b>: {{ info.type }}</div>
      <div><b>大小</b>: {{ fmtSize(info.size) }} ({{ info.size }} B)</div>
      <div v-if="info.format"><b>格式</b>: {{ info.format }}</div>
      <div v-if="info.width"><b>尺寸</b>: {{ info.width }} × {{ info.height }}</div>
      <div v-if="info.size_str"><b>像素</b>: {{ info.size_str }}</div>
      <div v-if="info.pages"><b>页数</b>: {{ info.pages }}</div>
      <div v-if="info.duration"><b>时长</b>: {{ info.duration }}</div>
      <div v-if="info.bitrate"><b>码率</b>: {{ info.bitrate }} kb/s</div>
      <div v-if="info.video !== undefined"><b>视频流</b>: {{ info.video ? '有' : '无' }}</div>
      <div v-if="info.audio !== undefined"><b>音频流</b>: {{ info.audio ? '有' : '无' }}</div>
    </div>
  </div>
</template>
