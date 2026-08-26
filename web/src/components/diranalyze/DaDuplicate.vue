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

async function doDuplicate() {
  if (!files.value.length) { error.value = '请上传文件或压缩包'; return }
  loading.value = true; error.value = ''; result.value = null
  try { result.value = await api.daDuplicate(files.value) }
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
    <div class="section-title">重复文件检测</div>
    <div class="hint" style="margin-bottom:8px;">按大小分组 → MD5 校验，找出内容相同的重复文件</div>
    <div class="search-bar" style="align-items:stretch;">
      <input type="file" multiple class="input" style="flex:1;" @change="onFiles" />
      <button class="btn btn-primary" :disabled="loading || !files.length" @click="doDuplicate">
        {{ loading ? '检测中...' : '检测重复' }}
      </button>
    </div>

    <div v-if="error" class="error" style="margin-top:12px;">{{ error }}</div>
    <div v-if="loading" class="loading" style="margin-top:12px;"><div class="spinner"></div> 检测中...</div>

    <div v-else-if="result" style="margin-top:14px;">
      <div class="ok" style="margin-bottom:10px;">找到 {{ result.total_groups }} 组重复文件</div>
      <div v-for="(g, gi) in result.duplicates" :key="gi" class="mono-block" style="margin-bottom:10px;">
        <div style="color:var(--text-faint);font-size:12px;margin-bottom:4px;">
          组 {{ gi + 1 }} | {{ fmtSize(g.size) }} | MD5: {{ g.hash }}
        </div>
        <div v-for="(f, fi) in g.files" :key="fi" style="padding:2px 0;">
          {{ fi + 1 }}. {{ f.name }}
        </div>
      </div>
      <div v-if="!result.duplicates.length" class="empty">未发现重复文件</div>
    </div>
  </div>
</template>
