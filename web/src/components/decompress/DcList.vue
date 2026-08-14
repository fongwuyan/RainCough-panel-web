<script setup>
import { ref } from 'vue'
import { api } from '../../api'

const file = ref(null)
const loading = ref(false)
const error = ref('')
const result = ref(null)

function onFile(e) {
  const f = e.target.files[0]
  if (f) { file.value = f; result.value = null; error.value = '' }
}

async function doList() {
  if (!file.value) { error.value = '请选择压缩包'; return }
  loading.value = true
  error.value = ''
  result.value = null
  try {
    result.value = await api.dcList(file.value)
  } catch (e) {
    error.value = e.message
  } finally {
    loading.value = false
  }
}

function fmtSize(n) {
  if (!n && n !== 0) return '-'
  const u = ['B', 'KB', 'MB', 'GB', 'TB']
  let i = 0
  let v = n
  while (v >= 1024 && i < u.length - 1) { v /= 1024; i++ }
  return `${v.toFixed(1)} ${u[i]}`
}
</script>

<template>
  <div class="section">
    <div class="section-title">列出压缩包内容</div>
    <div class="search-bar" style="align-items:stretch;">
      <input type="file" class="input" style="flex:1;" @change="onFile" />
      <button class="btn btn-primary" :disabled="loading || !file" @click="doList">
        {{ loading ? '解析中...' : '列出内容' }}
      </button>
    </div>

    <div v-if="error" class="error" style="margin-top:12px;">{{ error }}</div>

    <div v-if="loading" class="loading" style="margin-top:12px;">
      <div class="spinner"></div> 解析中...
    </div>

    <div v-else-if="result" style="margin-top:12px;">
      <div class="mono-block" style="margin-bottom:10px;">
        {{ result.name }} | 共 {{ result.total }} 项 | 展开大小 {{ fmtSize(result.total_size) }}
      </div>
      <div style="max-height:500px;overflow:auto;">
        <table class="mono-block" style="width:100%;font-size:12px;">
          <thead>
            <tr style="color:var(--text-faint);">
              <th style="text-align:left;padding:4px 8px;">路径</th>
              <th style="text-align:right;padding:4px 8px;">大小</th>
              <th style="text-align:right;padding:4px 8px;">压缩后</th>
              <th style="text-align:center;padding:4px 8px;">类型</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(f, i) in result.files" :key="i">
              <td style="padding:3px 8px;">{{ f.isDir ? '📁' : '📄' }} {{ f.path }}</td>
              <td style="text-align:right;padding:3px 8px;">{{ f.isDir ? '-' : fmtSize(f.size) }}</td>
              <td style="text-align:right;padding:3px 8px;">{{ f.isDir ? '-' : fmtSize(f.packed) }}</td>
              <td style="text-align:center;padding:3px 8px;">{{ f.isDir ? '目录' : '文件' }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>
