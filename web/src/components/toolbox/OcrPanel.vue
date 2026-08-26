<script setup>
import { ref, onMounted } from 'vue'
import { api } from '../../api'
import { copyText as copyToClipboard } from '../../utils/clipboard'

const file = ref(null)
const loading = ref(false)
const error = ref('')
const result = ref(null)
const ready = ref(null)

onMounted(async () => {
  try { ready.value = await api.tbOcrCheck() } catch (e) { ready.value = { ok: false, error: e.message } }
})

function onFile(e) {
  file.value = e.target.files[0] || null
  result.value = null
  error.value = ''
}

async function doOcr() {
  if (!file.value) { error.value = '请选择图片'; return }
  loading.value = true; error.value = ''; result.value = null
  try { result.value = await api.tbOcr(file.value) }
  catch (e) { error.value = e.message }
  finally { loading.value = false }
}

async function copyText() {
  if (!result.value || !result.value.text) return
  await copyToClipboard(result.value.text)
}
</script>

<template>
  <div class="section">
    <div class="section-title">OCR 图片文字识别</div>
    <div v-if="ready && !ready.ok" class="error" style="margin-bottom:12px;">
      OCR 模型未就绪{{ ready.error ? `：${ready.error}` : '' }}
    </div>
    <div class="search-bar" style="align-items:stretch;">
      <input type="file" accept="image/*" class="input" style="flex:1;" @change="onFile" />
      <button class="btn btn-primary" :disabled="loading || !file" @click="doOcr">
        {{ loading ? '识别中...' : '识别' }}
      </button>
    </div>

    <div v-if="error" class="error" style="margin-top:12px;">{{ error }}</div>
    <div v-if="loading" class="loading" style="margin-top:12px;"><div class="spinner"></div> 识别中（首次加载模型较慢）...</div>

    <div v-else-if="result" style="margin-top:14px;">
      <div v-for="(l, i) in result.lines" :key="i" class="mono-block" style="margin-bottom:6px;">
        <span class="tag-chip tag-chip-sm">{{ (l.score * 100).toFixed(1) }}%</span> {{ l.txt }}
      </div>
      <div class="section-title" style="margin-top:16px;">识别文本</div>
      <textarea class="input" style="width:100%;min-height:120px;font-family:var(--font-mono);font-size:12px;"
        :value="result.text" readonly></textarea>
      <div style="margin-top:10px;display:flex;gap:8px;">
        <button class="btn btn-ghost" @click="copyText">复制文本</button>
        <a v-if="result.text" class="btn btn-ghost"
           :href="'data:text/plain;charset=utf-8,' + encodeURIComponent(result.text)" download="ocr.txt">下载 .txt</a>
      </div>
    </div>
  </div>
</template>
