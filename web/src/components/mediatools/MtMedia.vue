<script setup>
import { ref } from 'vue'
import { api } from '../../api'

const action = ref('convert')
const files = ref([])
const fmt = ref('')
const crf = ref(28)
const loading = ref(false)
const error = ref('')
const result = ref(null)

const ACTIONS = [
  { key: 'convert', label: '格式转换' },
  { key: 'compress', label: '压缩' },
  { key: 'extract_audio', label: '提取音频' },
]

function onFiles(e) {
  files.value = Array.from(e.target.files)
  result.value = null
  error.value = ''
}

async function doRun() {
  if (!files.value.length) { error.value = '请选择媒体文件'; return }
  loading.value = true; error.value = ''; result.value = null
  try {
    result.value = await api.mtMedia(files.value, action.value, {
      format: fmt.value, crf: action.value === 'compress' ? crf.value : '',
    })
  } catch (e) { error.value = e.message }
  finally { loading.value = false }
}
</script>

<template>
  <div class="section">
    <div class="section-title">音视频处理</div>
    <div class="tabs">
      <button v-for="a in ACTIONS" :key="a.key" class="tab" :class="{ active: action === a.key }"
              @click="action = a.key">{{ a.label }}</button>
    </div>

    <input type="file" multiple class="input" @change="onFiles" style="margin-top:10px;" />
    <div class="hint" style="margin-top:6px;">
      <template v-if="action === 'convert'">选择媒体文件，转成指定格式（如 mp4/avi/mkv/webm/mp3）</template>
      <template v-else-if="action === 'compress'">用 H.264 压缩视频（CRF 越低质量越高）</template>
      <template v-else>从视频提取音频（mp3/aac/wav 等）</template>
    </div>

    <div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:10px;align-items:center;">
      <input v-model="fmt" class="input" style="width:120px;" placeholder="输出格式" />
      <template v-if="action === 'compress'">
        <label style="font-size:12px;color:var(--text-faint);">CRF</label>
        <input v-model.number="crf" class="input" style="width:90px;" type="number" />
      </template>
      <button class="btn btn-primary" :disabled="loading || !files.length" @click="doRun">
        {{ loading ? '处理中...' : '执行' }}
      </button>
    </div>

    <div v-if="error" class="error" style="margin-top:12px;">{{ error }}</div>
    <div v-if="loading" class="loading" style="margin-top:12px;"><div class="spinner"></div> 处理中（可能较慢）...</div>

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
