<script setup>
import { ref } from 'vue'
import { api } from '../../api'

const files = ref([])
const fmt = ref('')
const resize = ref('')
const quality = ref('')
const rotate = ref('')
const loading = ref(false)
const error = ref('')
const result = ref(null)

function onFiles(e) {
  files.value = Array.from(e.target.files)
  result.value = null
  error.value = ''
}

async function doRun() {
  if (!files.value.length) { error.value = '请选择图片'; return }
  loading.value = true; error.value = ''; result.value = null
  try {
    result.value = await api.mtImage(files.value, {
      format: fmt.value, resize: resize.value,
      quality: quality.value, rotate: rotate.value,
    })
  } catch (e) { error.value = e.message }
  finally { loading.value = false }
}
</script>

<template>
  <div class="section">
    <div class="section-title">图片处理</div>
    <input type="file" multiple class="input" @change="onFiles" />

    <div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:10px;align-items:center;">
      <input v-model="fmt" class="input" style="width:100px;" placeholder="格式" />
      <input v-model="resize" class="input" style="flex:1;min-width:120px;" placeholder="缩放如 50% 或 800x600" />
      <input v-model="quality" class="input" style="width:100px;" placeholder="质量 1-100" />
      <input v-model="rotate" class="input" style="width:100px;" placeholder="旋转角度" />
      <button class="btn btn-primary" :disabled="loading || !files.length" @click="doRun">
        {{ loading ? '处理中...' : '处理' }}
      </button>
    </div>
    <div class="hint" style="margin-top:6px;">格式/缩放/质量/旋转均为可选</div>

    <div v-if="error" class="error" style="margin-top:12px;">{{ error }}</div>
    <div v-if="loading" class="loading" style="margin-top:12px;"><div class="spinner"></div> 处理中...</div>

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
