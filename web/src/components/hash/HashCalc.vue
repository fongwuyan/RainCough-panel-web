<script setup>
import { ref } from 'vue'
import { api } from '../../api'

const files = ref([])
const loading = ref(false)
const error = ref('')
const result = ref(null)

function onFiles(e) {
  files.value = Array.from(e.target.files)
  result.value = null
  error.value = ''
}

async function doCalc() {
  if (!files.value.length) { error.value = '请选择文件'; return }
  loading.value = true; error.value = ''; result.value = null
  try { result.value = await api.hashCalc(files.value) }
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
    <div class="section-title">计算文件哈希</div>
    <div class="search-bar" style="align-items:stretch;">
      <input type="file" multiple class="input" style="flex:1;" @change="onFiles" />
      <button class="btn btn-primary" :disabled="loading || !files.length" @click="doCalc">
        {{ loading ? '计算中...' : '计算' }}
      </button>
    </div>

    <div v-if="error" class="error" style="margin-top:12px;">{{ error }}</div>
    <div v-if="loading" class="loading" style="margin-top:12px;"><div class="spinner"></div> 计算中...</div>

    <div v-else-if="result" style="margin-top:14px;">
      <div v-for="(r, i) in result.results" :key="i" class="mono-block" style="margin-bottom:12px;">
        <div style="font-weight:700;margin-bottom:6px;">{{ r.name }} <span style="color:var(--text-faint);font-weight:400;">({{ fmtSize(r.size) }})</span></div>
        <div style="word-break:break-all;"><b>MD5</b>: <span style="color:var(--accent);">{{ r.md5 }}</span></div>
        <div style="word-break:break-all;"><b>SHA1</b>: <span style="color:var(--accent);">{{ r.sha1 }}</span></div>
        <div style="word-break:break-all;"><b>SHA256</b>: <span style="color:var(--accent);">{{ r.sha256 }}</span></div>
      </div>
    </div>
  </div>
</template>
