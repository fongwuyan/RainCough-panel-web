<script setup>
import { ref } from 'vue'
import { api } from '../../api'

const action = ref('merge')
const files = ref([])
const dpi = ref(150)
const fmt = ref('png')
const loading = ref(false)
const error = ref('')
const result = ref(null)

const ACTIONS = [
  { key: 'merge', label: '合并' },
  { key: 'split', label: '拆分' },
  { key: 'compress', label: '压缩' },
  { key: 'extract', label: '转图片' },
]

function onFiles(e) {
  files.value = Array.from(e.target.files)
  result.value = null
  error.value = ''
}

async function doRun() {
  if (!files.value.length) { error.value = '请选择 PDF'; return }
  loading.value = true; error.value = ''; result.value = null
  try {
    const extra = {}
    if (action.value === 'compress') extra.dpi = dpi.value
    if (action.value === 'extract') extra.format = fmt.value
    result.value = await api.mtPdf(files.value, action.value, extra)
  } catch (e) { error.value = e.message }
  finally { loading.value = false }
}

function fmtSize(n) {
  const u = ['B', 'KB', 'MB', 'GB']
  let i = 0; let v = n
  while (v >= 1024 && i < u.length - 1) { v /= 1024; i++ }
  return `${v.toFixed(1)} ${u[i]}`
}
</script>

<template>
  <div class="section">
    <div class="section-title">PDF 工具</div>
    <div class="tabs">
      <button v-for="a in ACTIONS" :key="a.key" class="tab" :class="{ active: action === a.key }"
              @click="action = a.key">{{ a.label }}</button>
    </div>

    <input type="file" multiple class="input" @change="onFiles" style="margin-top:10px;" />
    <div class="hint" style="margin-top:6px;">
      <template v-if="action === 'merge'">选择 2 个以上 PDF 合并</template>
      <template v-else-if="action === 'split'">选择 1 个 PDF，拆分为单页</template>
      <template v-else-if="action === 'compress'">选择 1 个 PDF 压缩</template>
      <template v-else>选择 1 个 PDF，每页转为图片</template>
    </div>

    <div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:10px;align-items:center;">
      <template v-if="action === 'compress'">
        <label style="font-size:12px;color:var(--text-faint);">分辨率 DPI</label>
        <input v-model.number="dpi" class="input" style="width:100px;" type="number" />
      </template>
      <template v-if="action === 'extract'">
        <select v-model="fmt" class="input" style="width:auto;">
          <option value="png">PNG</option>
          <option value="jpg">JPG</option>
        </select>
      </template>
      <button class="btn btn-primary" :disabled="loading || !files.length" @click="doRun">
        {{ loading ? '处理中...' : '执行' }}
      </button>
    </div>

    <div v-if="error" class="error" style="margin-top:12px;">{{ error }}</div>
    <div v-if="loading" class="loading" style="margin-top:12px;"><div class="spinner"></div> 处理中...</div>

    <div v-else-if="result" style="margin-top:12px;">
      <template v-if="action === 'merge'"><div class="ok">合并完成：{{ result.pages }} 页</div></template>
      <template v-else-if="action === 'split'"><div class="ok">拆分为 {{ result.pages }} 页</div></template>
      <template v-else-if="action === 'compress'">
        <div class="ok">压缩：{{ fmtSize(result.input_size) }} → {{ fmtSize(result.output_size) }}</div>
      </template>
      <template v-else><div class="ok">提取 {{ result.pages }} 张图片</div></template>
      <div style="margin-top:10px;"><a class="btn btn-ghost" :href="result.download">下载结果</a></div>
    </div>
  </div>
</template>
