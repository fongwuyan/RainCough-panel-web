<script setup>
import { ref } from 'vue'
import { api } from '../../api'

const urls = ref('')
const pack = ref(true)
const loading = ref(false)
const error = ref('')
const result = ref(null)

async function doDownload() {
  const list = urls.value.split('\n').map(s => s.trim()).filter(Boolean)
  if (!list.length) { error.value = '请输入下载链接（每行一个）'; return }
  loading.value = true; error.value = ''; result.value = null
  try { result.value = await api.ntDownload(list, pack.value) }
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
    <div class="section-title">URL 批量下载</div>
    <textarea v-model="urls" class="input" rows="6"
              placeholder="每行一个下载链接" style="resize:vertical;font-family:var(--font-mono);font-size:12px;"></textarea>
    <div style="display:flex;gap:10px;align-items:center;margin-top:10px;">
      <label style="font-size:12px;color:var(--text-faint);display:flex;align-items:center;gap:6px;">
        <input type="checkbox" v-model="pack" /> 成功后打包
      </label>
      <button class="btn btn-primary" :disabled="loading" @click="doDownload">
        {{ loading ? '下载中...' : '开始下载' }}
      </button>
    </div>

    <div v-if="error" class="error" style="margin-top:12px;">{{ error }}</div>
    <div v-if="loading" class="loading" style="margin-top:12px;"><div class="spinner"></div> 下载中...</div>

    <div v-else-if="result" style="margin-top:12px;">
      <div v-for="(r, i) in result.results" :key="i" class="mono-block" style="margin-bottom:8px;font-size:12px;">
        <span :class="r.ok ? 'ok' : 'fail'">{{ r.ok ? '✔' : '✘' }}</span>
        <span style="word-break:break-all;">{{ r.url }}</span>
        <span v-if="r.ok" style="color:var(--text-faint);"> → {{ r.name }} ({{ fmtSize(r.size) }})</span>
        <span v-if="r.error" style="color:var(--danger);"> {{ r.error }}</span>
      </div>
      <template v-if="result.packed">
        <div style="margin-top:10px;"><a class="btn btn-ghost" :href="result.download">下载打包结果</a></div>
      </template>
      <template v-else>
        <div style="margin-top:10px;">
          <a v-for="f in result.files" :key="f.name" class="btn btn-ghost btn-sm" style="margin-right:6px;" :href="f.download">{{ f.name }}</a>
        </div>
      </template>
    </div>
  </div>
</template>
