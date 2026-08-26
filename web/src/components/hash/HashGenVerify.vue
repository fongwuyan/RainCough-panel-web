<script setup>
import { ref } from 'vue'
import { api } from '../../api'

const mode = ref('gen')  // gen | verify
const files = ref([])
const algo = ref('sha256')
const loading = ref(false)
const error = ref('')
const result = ref(null)

function onFiles(e) {
  files.value = Array.from(e.target.files)
  result.value = null
  error.value = ''
}

async function doRun() {
  if (!files.value.length) { error.value = '请选择文件'; return }
  loading.value = true; error.value = ''; result.value = null
  try {
    if (mode.value === 'gen') {
      result.value = await api.hashGenerate(files.value, algo.value)
    } else {
      result.value = await api.hashVerify(files.value)
    }
  } catch (e) { error.value = e.message }
  finally { loading.value = false }
}
</script>

<template>
  <div class="section">
    <div class="section-title">校验文件生成 / 验证</div>
    <div class="tabs">
      <button class="tab" :class="{ active: mode === 'gen' }" @click="mode = 'gen'">生成校验文件</button>
      <button class="tab" :class="{ active: mode === 'verify' }" @click="mode = 'verify'">验证校验文件</button>
    </div>

    <div class="hint" style="margin-top:10px;">
      {{ mode === 'gen' ? '选择文件，生成 .md5/.sha1/.sha256 校验文件' : '选择校验文件 (.md5/.sha1/.sha256) 与对应的数据文件' }}
    </div>
    <div class="search-bar" style="align-items:stretch;margin-top:8px;">
      <input type="file" multiple class="input" style="flex:1;" @change="onFiles" />
      <select v-if="mode === 'gen'" v-model="algo" class="input" style="width:auto;">
        <option value="md5">MD5</option>
        <option value="sha1">SHA1</option>
        <option value="sha256">SHA256</option>
      </select>
      <button class="btn btn-primary" :disabled="loading || !files.length" @click="doRun">
        {{ loading ? '处理中...' : (mode === 'gen' ? '生成' : '验证') }}
      </button>
    </div>

    <div v-if="error" class="error" style="margin-top:12px;">{{ error }}</div>
    <div v-if="loading" class="loading" style="margin-top:12px;"><div class="spinner"></div> 处理中...</div>

    <div v-if="result && mode === 'gen'" style="margin-top:12px;">
      <div class="ok">已生成 {{ result.count }} 条 {{ result.algo }} 记录</div>
      <div style="margin-top:10px;"><a class="btn btn-ghost" :href="result.download">下载校验文件</a></div>
    </div>

    <div v-if="result && mode === 'verify'" style="margin-top:12px;">
      <div class="ok" style="margin-bottom:10px;">
        通过 {{ result.passed }} / {{ result.total }}<span v-if="result.failed" style="color:var(--danger);">，失败 {{ result.failed }}</span>
      </div>
      <div v-for="(r, i) in result.results" :key="i" class="mono-block" style="margin-bottom:8px;font-size:12px;">
        <span :class="{ ok: r.status === 'ok', fail: r.status !== 'ok' }">
          {{ r.status === 'ok' ? '✔' : (r.status === 'missing' ? '✘ 缺失' : '✘ 不匹配') }}
        </span>
        {{ r.file }}
        <span style="color:var(--text-faint);word-break:break-all;">
          <span v-if="r.status === 'ok'"> {{ r.expected }}</span>
          <span v-else-if="r.expected"> 期望 {{ r.expected }}</span>
          <span v-if="r.actual"> 实际 {{ r.actual }}</span>
        </span>
      </div>
    </div>
  </div>
</template>
