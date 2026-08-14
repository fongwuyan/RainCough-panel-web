<script setup>
import { ref } from 'vue'
import { api } from '../../api'

const files = ref([])
const loading = ref(false)
const error = ref('')
const result = ref(null)

const COLORS = {
  图片: 'var(--accent)',
  视频: 'var(--danger)',
  音频: 'var(--success)',
  文档: 'var(--warning, #e6a23c)',
  压缩包: 'var(--text-muted)',
  代码: 'var(--text-faint)',
  其他: 'var(--text-faint)',
}

function onFiles(e) {
  files.value = Array.from(e.target.files)
  result.value = null
  error.value = ''
}

async function doStats() {
  if (!files.value.length) { error.value = '请上传文件或压缩包'; return }
  loading.value = true; error.value = ''; result.value = null
  try { result.value = await api.daStats(files.value) }
  catch (e) { error.value = e.message }
  finally { loading.value = false }
}

function fmtSize(n) {
  const u = ['B', 'KB', 'MB', 'GB', 'TB']
  let i = 0; let v = n
  while (v >= 1024 && i < u.length - 1) { v /= 1024; i++ }
  return `${v.toFixed(1)} ${u[i]}`
}

function pct(n) {
  return result.value && result.value.total_size
    ? Math.round(n / result.value.total_size * 100)
    : 0
}
</script>

<template>
  <div class="section">
    <div class="section-title">目录分类统计</div>
    <div class="hint" style="margin-bottom:8px;">直接上传文件，或上传 ZIP 压缩包（会解压后递归统计）</div>
    <div class="search-bar" style="align-items:stretch;">
      <input type="file" multiple class="input" style="flex:1;" @change="onFiles" />
      <button class="btn btn-primary" :disabled="loading || !files.length" @click="doStats">
        {{ loading ? '统计中...' : '统计' }}
      </button>
    </div>

    <div v-if="error" class="error" style="margin-top:12px;">{{ error }}</div>
    <div v-if="loading" class="loading" style="margin-top:12px;"><div class="spinner"></div> 统计中...</div>

    <div v-else-if="result" style="margin-top:14px;">
      <div class="mono-block" style="margin-bottom:10px;">
        共 {{ result.total_files }} 个文件 | 总大小 {{ fmtSize(result.total_size) }}
      </div>
      <div v-for="c in result.categories" :key="c.name"
           v-show="c.count > 0" style="margin-bottom:8px;">
        <div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:4px;">
          <span style="color:var(--text-muted);">
            <span :style="{ color: COLORS[c.name] }">●</span> {{ c.name }}
            <span style="margin-left:8px;">{{ c.count }} 个</span>
          </span>
          <span style="font-family:var(--font-mono);">{{ fmtSize(c.size) }} ({{ pct(c.size) }}%)</span>
        </div>
        <div class="progress"><div :style="{ width: pct(c.size) + '%', background: COLORS[c.name] }"></div></div>
      </div>
      <div v-if="!result.categories.some(c => c.count > 0)" class="empty">没有可统计的文件</div>
    </div>
  </div>
</template>
