<script setup>
import { ref } from 'vue'
import { api } from '../../api'

const files = ref([])
const mode = ref('prefix')
const value = ref('')
const value2 = ref('')
const index = ref(1)
const loading = ref(false)
const error = ref('')
const result = ref(null)

const MODES = [
  { key: 'prefix', label: '前缀' },
  { key: 'suffix', label: '后缀' },
  { key: 'replace', label: '替换' },
  { key: 'case', label: '大小写' },
  { key: 'regex', label: '正则' },
  { key: 'number', label: '编号' },
]

function onFiles(e) {
  files.value = Array.from(e.target.files)
  result.value = null
  error.value = ''
}

async function doRename() {
  if (!files.value.length) { error.value = '请选择文件'; return }
  if ((mode.value === 'prefix' || mode.value === 'suffix') && !value.value) {
    error.value = '请输入要添加的文本'; return
  }
  if (mode.value === 'replace' && !value.value) { error.value = '请输入要被替换的文本'; return }
  if (mode.value === 'regex' && !value.value) { error.value = '请输入正则表达式'; return }
  loading.value = true; error.value = ''; result.value = null
  try {
    result.value = await api.ntRename(files.value, mode.value, value.value, value2.value, index.value)
  } catch (e) { error.value = e.message }
  finally { loading.value = false }
}
</script>

<template>
  <div class="section">
    <div class="section-title">批量重命名</div>
    <input type="file" multiple class="input" @change="onFiles" />

    <div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:10px;align-items:center;">
      <select v-model="mode" class="input" style="width:auto;">
        <option v-for="m in MODES" :key="m.key" :value="m.key">{{ m.label }}</option>
      </select>
      <input v-model="value" class="input" style="flex:1;min-width:120px;"
             :placeholder="mode === 'case' ? 'upper / lower' : '内容'" />
      <input v-if="mode === 'replace' || mode === 'regex'" v-model="value2" class="input" style="flex:1;min-width:120px;"
             placeholder="替换为" />
      <input v-if="mode === 'number'" v-model.number="index" class="input" style="width:100px;" type="number" placeholder="起始编号" />
      <button class="btn btn-primary" :disabled="loading || !files.length" @click="doRename">
        {{ loading ? '重命名中...' : '重命名' }}
      </button>
    </div>

    <div v-if="error" class="error" style="margin-top:12px;">{{ error }}</div>
    <div v-if="loading" class="loading" style="margin-top:12px;"><div class="spinner"></div> 重命名中...</div>

    <div v-else-if="result" style="margin-top:12px;">
      <div v-for="(r, i) in result.results" :key="i" class="mono-block" style="margin-bottom:6px;font-size:12px;">
        <span class="ok">✔</span> {{ r.old }} <span style="color:var(--text-faint);">→</span> {{ r.new }}
      </div>
      <div style="margin-top:10px;"><a class="btn btn-ghost" :href="result.download">下载重命名后文件 (ZIP)</a></div>
    </div>
  </div>
</template>
