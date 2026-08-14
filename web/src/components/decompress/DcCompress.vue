<script setup>
import { ref } from 'vue'
import { api } from '../../api'

const files = ref([])
const fmt = ref('7z')
const level = ref(5)
const password = ref('')
const name = ref('archive')
const loading = ref(false)
const error = ref('')
const result = ref(null)

const FORMATS = ['7z', 'zip', 'tar', 'gz', 'bz2', 'xz']
const LEVELS = [0, 1, 3, 5, 7, 9]

function onFiles(e) {
  files.value = Array.from(e.target.files)
  result.value = null
  error.value = ''
}

async function doCompress() {
  if (!files.value.length) { error.value = '请选择要压缩的文件'; return }
  loading.value = true
  error.value = ''
  result.value = null
  try {
    result.value = await api.dcCompress(files.value, fmt.value, level.value, password.value, name.value)
  } catch (e) {
    error.value = e.message
  } finally {
    loading.value = false
  }
}

function fmtSize(n) {
  const u = ['B', 'KB', 'MB', 'GB', 'TB']
  let i = 0
  let v = n
  while (v >= 1024 && i < u.length - 1) { v /= 1024; i++ }
  return `${v.toFixed(1)} ${u[i]}`
}
</script>

<template>
  <div class="section">
    <div class="section-title">批量压缩</div>
    <input type="file" multiple class="input" @change="onFiles" />
    <div v-if="files.length" class="hint" style="margin-top:6px;">已选择 {{ files.length }} 个文件</div>

    <div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:10px;align-items:center;">
      <select v-model="fmt" class="input" style="width:auto;">
        <option v-for="f in FORMATS" :key="f" :value="f">{{ f }}</option>
      </select>
      <select v-model="level" class="input" style="width:auto;">
        <option v-for="l in LEVELS" :key="l" :value="l">压缩级别 {{ l }}</option>
      </select>
      <input v-model="password" class="input" style="flex:1;min-width:120px;" placeholder="密码（可选）" type="password" />
      <input v-model="name" class="input" style="flex:1;min-width:120px;" placeholder="输出文件名" />
      <button class="btn btn-primary" :disabled="loading || !files.length" @click="doCompress">
        {{ loading ? '压缩中...' : '压缩' }}
      </button>
    </div>

    <div v-if="error" class="error" style="margin-top:12px;">{{ error }}</div>
    <div v-if="loading" class="loading" style="margin-top:12px;"><div class="spinner"></div> 压缩中...</div>

    <div v-else-if="result" style="margin-top:12px;">
      <div class="ok">打包成功：{{ fmtSize(result.size) }}</div>
      <div style="margin-top:10px;">
        <a class="btn btn-ghost" :href="result.download">下载压缩包</a>
      </div>
    </div>
  </div>
</template>
