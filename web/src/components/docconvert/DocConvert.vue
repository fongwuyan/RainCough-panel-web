<script setup>
import { ref, onMounted } from 'vue'
import { api } from '../../api'

const files = ref([])
const to = ref('html')
const loading = ref(false)
const error = ref('')
const result = ref(null)
const status = ref(null)

const TARGETS = ['html', 'markdown', 'docx', 'epub', 'latex', 'pdf', 'txt', 'rst', 'pptx', 'odt', 'json']

onMounted(async () => {
  try {
    status.value = await api.docCheck()
  } catch (e) {
    status.value = { ok: false, error: e.message }
  }
})

function onFiles(e) {
  files.value = Array.from(e.target.files)
  result.value = null
  error.value = ''
}

async function doConvert() {
  if (!files.value.length) { error.value = '请选择文档'; return }
  loading.value = true; error.value = ''; result.value = null
  try { result.value = await api.docConvert(files.value, to.value) }
  catch (e) { error.value = e.message }
  finally { loading.value = false }
}
</script>

<template>
  <div class="section">
    <div v-if="status && status.ok" class="hint" style="margin-bottom:10px;">
      Pandoc {{ status.version }}
    </div>
    <div v-else-if="status" class="error" style="margin-bottom:10px;">{{ status.error || 'Pandoc 不可用' }}</div>

    <div class="section-title">文档格式互转</div>
    <input type="file" multiple class="input" @change="onFiles" />

    <div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:10px;align-items:center;">
      <select v-model="to" class="input" style="width:auto;">
        <option v-for="t in TARGETS" :key="t" :value="t">{{ t }}</option>
      </select>
      <button class="btn btn-primary" :disabled="loading || !files.length" @click="doConvert">
        {{ loading ? '转换中...' : '转换' }}
      </button>
    </div>

    <div v-if="error" class="error" style="margin-top:12px;">{{ error }}</div>
    <div v-if="loading" class="loading" style="margin-top:12px;"><div class="spinner"></div> 转换中...</div>

    <div v-else-if="result" style="margin-top:12px;">
      <div v-for="(r, i) in result.results" :key="i" class="mono-block" style="margin-bottom:8px;font-size:12px;">
        <span :class="r.ok ? 'ok' : 'fail'">{{ r.ok ? '✔' : '✘' }}</span>
        {{ r.name }} <span v-if="r.ok" style="color:var(--text-faint);">→ {{ r.output }}</span>
        <span v-if="r.error" style="color:var(--danger);word-break:break-all;"> {{ r.error }}</span>
      </div>
      <div style="margin-top:10px;"><a class="btn btn-ghost" :href="result.download">下载结果</a></div>
    </div>
  </div>
</template>
