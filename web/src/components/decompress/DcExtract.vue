<script setup>
import { ref } from 'vue'
import { api } from '../../api'

const file = ref(null)
const password = ref('')
const organize = ref('none')
const loading = ref(false)
const error = ref('')
const result = ref(null)

const MODES = [
  { key: 'none', label: '不解压' },
  { key: 'type', label: '按类型' },
  { key: 'date', label: '按日期' },
  { key: 'ext', label: '按扩展名' },
  { key: 'name', label: '按首字母' },
]

function onFile(e) {
  const f = e.target.files[0]
  if (f) { file.value = f; result.value = null; error.value = '' }
}

async function doExtract() {
  if (!file.value) { error.value = '请选择压缩包'; return }
  loading.value = true
  error.value = ''
  result.value = null
  try {
    result.value = await api.dcExtract(file.value, password.value, organize.value)
  } catch (e) {
    error.value = e.message
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="section">
    <div class="section-title">解压（可选归类）</div>
    <div class="search-bar" style="align-items:stretch;">
      <input type="file" class="input" style="flex:1;" @change="onFile" />
    </div>
    <div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:10px;align-items:center;">
      <input v-model="password" class="input" style="flex:1;min-width:140px;" placeholder="密码（可选）" type="password" />
      <select v-model="organize" class="input" style="width:auto;">
        <option v-for="m in MODES" :key="m.key" :value="m.key">{{ m.label }}</option>
      </select>
      <button class="btn btn-primary" :disabled="loading || !file" @click="doExtract">
        {{ loading ? '解压中...' : '解压' }}
      </button>
    </div>

    <div v-if="error" class="error" style="margin-top:12px;">{{ error }}</div>
    <div v-if="loading" class="loading" style="margin-top:12px;"><div class="spinner"></div> 解压中...</div>

    <div v-else-if="result" style="margin-top:12px;">
      <div class="ok">解压完成：{{ result.count }} 个文件</div>
      <div style="margin-top:10px;">
        <a class="btn btn-ghost" :href="result.download">下载解压结果 (ZIP)</a>
      </div>
    </div>
  </div>
</template>
