<script setup>
import { ref } from 'vue'
import { api } from '../../api'

const simA = ref(null)
const simB = ref(null)
const simLoading = ref(false)
const simError = ref('')
const simResult = ref(null)

const procFiles = ref([])
const format = ref('')
const resize = ref('')
const quality = ref('')
const rotate = ref('')
const procLoading = ref(false)
const procError = ref('')
const procResult = ref(null)

function onSimA(e) { simA.value = e.target.files[0] || null; simResult.value = null }
function onSimB(e) { simB.value = e.target.files[0] || null; simResult.value = null }

async function doSimilar() {
  if (!simA.value || !simB.value) { simError.value = '请选择两张图片'; return }
  simLoading.value = true; simError.value = ''; simResult.value = null
  try { simResult.value = await api.tbImgSimilar(simA.value, simB.value) }
  catch (e) { simError.value = e.message }
  finally { simLoading.value = false }
}

function onProcFiles(e) {
  procFiles.value = Array.from(e.target.files)
  procResult.value = null
  procError.value = ''
}

async function doProcess() {
  if (!procFiles.value.length) { procError.value = '请选择图片'; return }
  procLoading.value = true; procError.value = ''; procResult.value = null
  try {
    procResult.value = await api.tbImgProcess(procFiles.value, {
      format: format.value, resize: resize.value,
      quality: quality.value, rotate: rotate.value,
    })
  } catch (e) { procError.value = e.message }
  finally { procLoading.value = false }
}
</script>

<template>
  <div class="section">
    <div class="section-title">图片相似度比对</div>
    <div class="search-bar" style="align-items:stretch;">
      <input type="file" accept="image/*" class="input" style="flex:1;" @change="onSimA" />
      <input type="file" accept="image/*" class="input" style="flex:1;" @change="onSimB" />
      <button class="btn btn-primary" :disabled="simLoading" @click="doSimilar">比对</button>
    </div>
    <div v-if="simError" class="error" style="margin-top:10px;">{{ simError }}</div>
    <div v-if="simLoading" class="loading" style="margin-top:10px;"><div class="spinner"></div></div>
    <div v-else-if="simResult" style="margin-top:12px;">
      <div class="mono-block">
        <span style="font-weight:700;">{{ simResult.a }}</span> vs
        <span style="font-weight:700;">{{ simResult.b }}</span>
      </div>
      <div style="margin-top:8px;font-size:13px;">
        相似度 <b :class="simResult.similarity >= 70 ? 'ok' : (simResult.similarity >= 40 ? '' : 'fail')">{{ simResult.similarity }}%</b>
        <span class="tag-chip" style="margin-left:8px;">{{ simResult.verdict }}</span>
      </div>
    </div>
  </div>

  <div class="section">
    <div class="section-title">图片处理（转换 / 缩放 / 压缩 / 旋转）</div>
    <input type="file" multiple accept="image/*" class="input" style="width:100%;" @change="onProcFiles" />
    <div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:10px;align-items:center;">
      <input v-model="format" class="input" style="width:100px;" placeholder="格式(png/jpg/webp)" />
      <input v-model="resize" class="input" style="width:110px;" placeholder="缩放 如 50% / 300x" />
      <input v-model="quality" class="input" style="width:90px;" placeholder="质量 1-100" />
      <input v-model="rotate" class="input" style="width:90px;" placeholder="旋转角度" />
      <button class="btn btn-primary" :disabled="procLoading || !procFiles.length" @click="doProcess">
        {{ procLoading ? '处理中...' : '处理' }}
      </button>
    </div>
    <div v-if="procError" class="error" style="margin-top:10px;">{{ procError }}</div>
    <div v-if="procLoading" class="loading" style="margin-top:10px;"><div class="spinner"></div></div>
    <div v-else-if="procResult" style="margin-top:12px;">
      <div v-for="(r, i) in procResult.results" :key="i" class="mono-block" style="margin-bottom:6px;">
        <span :class="r.ok ? 'ok' : 'fail'">{{ r.ok ? '成功' : '失败' }}</span> {{ r.name }}
        <span v-if="!r.ok" class="fail"> - {{ r.error }}</span>
      </div>
      <div style="margin-top:10px;"><a class="btn btn-ghost" :href="procResult.download">下载处理结果</a></div>
    </div>
  </div>
</template>
